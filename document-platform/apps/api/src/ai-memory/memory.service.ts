import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemoryDomain,
  MemorySourceType,
  MemoryStatus,
  MemoryTrustLevel,
  MemoryType,
  MemoryVisibility,
  OrgRole,
  Prisma,
} from '@prisma/client';
import { apiLogger } from '@docconv/logging';
import { PrismaService } from '../common/prisma.service';
import { AiProvider } from './ai-provider.service';
import { MemoryAccessService } from './memory-access.service';
import { MemoryConfigService } from './memory.config';
import {
  ExtractedMemoryCandidate,
  normalizeConceptKey,
  rankMemories,
  redactSecrets,
  resolveMemoryWrite,
  takeWithinTokenBudget,
} from './memory-core';
import { CreateMemoryDto, MemoryQueryDto, UpdateMemoryDto } from './memory.dto';

interface ExtractedMemorySource {
  organizationId: string;
  projectId: string;
  userId: string;
  conversationId: string;
  messageId: string;
}

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MemoryAccessService,
    private readonly config: MemoryConfigService,
    private readonly provider: AiProvider,
  ) {}

  async list(userId: string, organizationId: string | undefined, query: MemoryQueryDto) {
    await this.access.assertMembership(userId, organizationId);
    const page = Number(query.page) || 1;
    const pageSize = Math.min(100, Number(query.pageSize) || 25);
    const where: Prisma.AiMemoryWhereInput = {
      organizationId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      status: query.status || MemoryStatus.ACTIVE,
      ...(query.type ? { type: query.type } : {}),
      OR: [
        { visibility: MemoryVisibility.PROJECT },
        { visibility: MemoryVisibility.USER, createdByUserId: userId },
      ],
      ...(query.query
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: query.query, mode: 'insensitive' } },
                  { content: { contains: query.query, mode: 'insensitive' } },
                  { conceptKey: { contains: normalizeConceptKey(query.query), mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };
    if (query.projectId) await this.access.project(userId, organizationId, query.projectId);
    const [items, total] = await Promise.all([
      this.prisma.aiMemory.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { importance: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sourceConversation: { select: { id: true } },
          sourceMessage: { select: { id: true, createdAt: true } },
          supersededBy: { select: { id: true, title: true } },
        },
      }),
      this.prisma.aiMemory.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(userId: string, organizationId: string | undefined, memoryId: string) {
    await this.access.assertMembership(userId, organizationId);
    const memory = await this.prisma.aiMemory.findFirst({
      where: {
        id: memoryId,
        organizationId,
        OR: [
          { visibility: MemoryVisibility.PROJECT },
          { visibility: MemoryVisibility.USER, createdByUserId: userId },
        ],
      },
      include: {
        sourceConversation: { select: { id: true, createdAt: true } },
        sourceMessage: { select: { id: true, createdAt: true } },
        supersededBy: { select: { id: true, title: true, content: true } },
      },
    });
    if (!memory) throw new NotFoundException('Memory not found.');
    return memory;
  }

  async create(userId: string, organizationId: string | undefined, dto: CreateMemoryDto) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.access.project(userId, organizationId, dto.projectId);
    const title = this.ensureSafe(dto.title);
    const content = this.ensureSafe(dto.content);
    const memory = await this.upsertCanonical({
      organizationId: organizationId!,
      projectId: dto.projectId,
      userId,
      type: dto.type,
      title,
      content,
      conceptKey: normalizeConceptKey(dto.conceptKey || title),
      importance: dto.importance ?? 0.9,
      confidence: 1,
      visibility: dto.visibility || MemoryVisibility.PROJECT,
      domain: dto.domain || MemoryDomain.PROJECT_MEMORY,
      sourceType: MemorySourceType.USER_CREATED,
      sourceTrust: MemoryTrustLevel.EXPLICIT,
      pinned: dto.pinned ?? false,
      metadata: dto.metadata,
      relationship: 'NEW',
    });
    await this.audit(organizationId!, userId, 'AI_MEMORY_CREATE', memory.id, {
      projectId: dto.projectId,
      type: dto.type,
      outcome: memory.createdByUserId === userId ? 'created_or_updated' : 'deduplicated',
    });
    return memory;
  }

  async update(
    userId: string,
    organizationId: string | undefined,
    memoryId: string,
    dto: UpdateMemoryDto,
  ) {
    const membership = await this.access.assertCanWrite(userId, organizationId);
    const existing = await this.get(userId, organizationId, memoryId);
    const isAdministrator =
      membership.role === OrgRole.OWNER || membership.role === OrgRole.ADMIN;
    if (existing.createdByUserId !== userId && !isAdministrator) {
      throw new ForbiddenException('Only the memory author or an organization administrator can edit it.');
    }
    const title = dto.title ? this.ensureSafe(dto.title) : existing.title;
    const content = dto.content ? this.ensureSafe(dto.content) : existing.content;
    const shouldReembed = title !== existing.title || content !== existing.content;
    const embedding = shouldReembed ? await this.provider.embedText(`${title}\n${content}`) : null;
    const updated = await this.prisma.aiMemory.update({
      where: { id: existing.id },
      data: {
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.title ? { title } : {}),
        ...(dto.content ? { content } : {}),
        ...(dto.conceptKey ? { conceptKey: normalizeConceptKey(dto.conceptKey) } : {}),
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
        ...(dto.domain ? { domain: dto.domain } : {}),
        ...(dto.status ? { status: dto.status, deletedAt: dto.status === MemoryStatus.DELETED ? new Date() : null } : {}),
        ...(dto.importance !== undefined ? { importance: dto.importance } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        ...(dto.metadata ? { metadataJson: dto.metadata as Prisma.InputJsonValue } : {}),
        ...(embedding
          ? {
              embedding,
              embeddingProvider: this.provider.providerName,
              embeddingModel: this.provider.embeddingModel,
              embeddingVersion: '1',
            }
          : {}),
      },
    });
    await this.audit(organizationId!, userId, 'AI_MEMORY_UPDATE', updated.id, {
      projectId: updated.projectId,
      changedFields: Object.keys(dto),
    });
    return updated;
  }

  async archive(userId: string, organizationId: string | undefined, memoryId: string) {
    return this.update(userId, organizationId, memoryId, { status: MemoryStatus.ARCHIVED });
  }

  async softDelete(userId: string, organizationId: string | undefined, memoryId: string) {
    return this.update(userId, organizationId, memoryId, { status: MemoryStatus.DELETED });
  }

  async saveExtracted(candidate: ExtractedMemoryCandidate, source: ExtractedMemorySource) {
    const safeTitle = redactSecrets(candidate.title);
    const safeContent = redactSecrets(candidate.content);
    if (safeTitle.redacted || safeContent.redacted) {
      apiLogger.warn({ projectId: source.projectId, type: candidate.type }, 'memory_candidate_rejected_secret');
      return null;
    }
    return this.upsertCanonical({
      organizationId: source.organizationId,
      projectId: source.projectId,
      userId: source.userId,
      type: candidate.type as MemoryType,
      title: safeTitle.text,
      content: safeContent.text,
      conceptKey: normalizeConceptKey(candidate.conceptKey || candidate.title),
      importance: candidate.importance,
      confidence: candidate.confidence,
      visibility: MemoryVisibility.PROJECT,
      domain: candidate.type === 'CODE_KNOWLEDGE' ? MemoryDomain.CODE_KNOWLEDGE : MemoryDomain.PROJECT_MEMORY,
      sourceType: MemorySourceType.AUTO_EXTRACTED,
      sourceTrust: MemoryTrustLevel.ASSISTANT,
      sourceConversationId: source.conversationId,
      sourceMessageId: source.messageId,
      pinned: false,
      relationship: candidate.relationship,
    });
  }

  async retrieve(
    userId: string,
    organizationId: string,
    projectId: string,
    query: string,
    tokenBudget = this.config.budgets.memories,
  ) {
    await this.access.project(userId, organizationId, projectId);
    const queryEmbedding = await this.provider.embedText(query);
    const candidates = await this.prisma.aiMemory.findMany({
      where: {
        organizationId,
        projectId,
        status: MemoryStatus.ACTIVE,
        deletedAt: null,
        OR: [
          { visibility: MemoryVisibility.PROJECT },
          { visibility: MemoryVisibility.USER, createdByUserId: userId },
        ],
      },
      orderBy: [{ pinned: 'desc' }, { importance: 'desc' }, { updatedAt: 'desc' }],
      take: this.config.candidateLimit,
    });
    const ranked = rankMemories(candidates, query, queryEmbedding || undefined, this.config.weights)
      .slice(0, this.config.retrievedLimit);
    const selected = takeWithinTokenBudget(ranked, tokenBudget, ({ memory }) => `${memory.title}\n${memory.content}`);
    const ids = selected.map(({ memory }) => memory.id);
    if (ids.length) {
      await this.prisma.aiMemory.updateMany({
        where: { id: { in: ids }, organizationId, projectId },
        data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
      });
    }
    return selected;
  }

  async search(
    userId: string,
    organizationId: string | undefined,
    projectId: string,
    query: string,
    tokenBudget?: number,
  ) {
    await this.access.assertMembership(userId, organizationId);
    const ranked = await this.retrieve(
      userId,
      organizationId!,
      projectId,
      query.trim(),
      tokenBudget,
    );
    return ranked.map(({ memory, score, semanticScore, lexicalScore }) => ({
      memory: this.publicRecord(memory),
      score,
      semanticScore,
      lexicalScore,
    }));
  }

  private async upsertCanonical(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    type: MemoryType;
    title: string;
    content: string;
    conceptKey: string;
    importance: number;
    confidence: number;
    visibility: MemoryVisibility;
    domain: MemoryDomain;
    sourceType: MemorySourceType;
    sourceTrust: MemoryTrustLevel;
    sourceConversationId?: string;
    sourceMessageId?: string;
    pinned: boolean;
    metadata?: Record<string, unknown>;
    relationship: ExtractedMemoryCandidate['relationship'];
  }) {
    const embedding = await this.provider.embedText(`${input.title}\n${input.content}`);
    const active = await this.prisma.aiMemory.findMany({
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        status: MemoryStatus.ACTIVE,
        OR: [
          { conceptKey: input.conceptKey },
          { type: input.type },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    const resolution = resolveMemoryWrite(
      active,
      input,
      this.config.duplicateThreshold,
      this.config.conflictThreshold,
    );
    const matched = active.find((memory) => memory.id === resolution.existingId);
    if (resolution.action === 'DUPLICATE' && matched) {
      return this.prisma.aiMemory.update({
        where: { id: matched.id },
        data: {
          importance: Math.max(matched.importance, input.importance),
          confidence: Math.max(matched.confidence, input.confidence),
          pinned: matched.pinned || input.pinned,
          accessCount: { increment: 1 },
        },
      });
    }
    const shouldSupersede = resolution.action === 'SUPERSEDE' && Boolean(matched);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.aiMemory.create({
        data: {
          organizationId: input.organizationId,
          projectId: input.projectId,
          createdByUserId: input.userId,
          visibility: input.visibility,
          domain: input.domain,
          type: input.type,
          title: input.title,
          content: input.content,
          conceptKey: input.conceptKey,
          importance: input.importance,
          confidence: input.confidence,
          sourceType: input.sourceType,
          sourceTrust: input.sourceTrust,
          sourceConversationId: input.sourceConversationId,
          sourceMessageId: input.sourceMessageId,
          pinned: input.pinned,
          embedding: embedding || [],
          embeddingProvider: embedding ? this.provider.providerName : null,
          embeddingModel: embedding ? this.provider.embeddingModel : null,
          embeddingVersion: embedding ? '1' : null,
          metadataJson: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      if (shouldSupersede && matched) {
        await tx.aiMemory.update({
          where: { id: matched.id },
          data: { status: MemoryStatus.SUPERSEDED, supersededByMemoryId: created.id },
        });
      }
      apiLogger.info(
        {
          memoryId: created.id,
          projectId: input.projectId,
          sourceType: input.sourceType,
          supersededMemoryId: shouldSupersede ? matched?.id : undefined,
        },
        'memory_saved',
      );
      return created;
    });
  }

  private ensureSafe(value: string): string {
    const result = redactSecrets(value.trim());
    if (result.redacted) {
      throw new BadRequestException('Potential credentials or secret material cannot be stored as memory.');
    }
    return result.text;
  }

  private publicRecord<T extends { embedding?: number[] }>(memory: T): Omit<T, 'embedding'> {
    const { embedding: _embedding, ...record } = memory;
    return record;
  }

  private async audit(
    organizationId: string,
    userId: string,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: 'AI_MEMORY',
        resourceId,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
