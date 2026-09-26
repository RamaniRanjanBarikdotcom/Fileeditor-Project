import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiConversationStatus, AiMessageRole } from '@prisma/client';
import { apiLogger } from '@docconv/logging';
import { PrismaService } from '../common/prisma.service';
import { AiProvider } from './ai-provider.service';
import { ContextBuilderService } from './context-builder.service';
import { MemoryAccessService } from './memory-access.service';
import { CreateConversationDto, SendMessageDto, UpdateConversationDto } from './memory.dto';
import { estimateTokens, redactSecrets } from './memory-core';
import { MemoryJobsService } from './memory-jobs.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MemoryAccessService,
    private readonly provider: AiProvider,
    private readonly contextBuilder: ContextBuilderService,
    private readonly jobs: MemoryJobsService,
  ) {}

  async list(userId: string, organizationId: string | undefined, projectId: string) {
    await this.access.project(userId, organizationId, projectId);
    return this.prisma.aiConversation.findMany({
      where: { organizationId, projectId, userId, status: AiConversationStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async create(
    userId: string,
    organizationId: string | undefined,
    projectId: string,
    dto: CreateConversationDto,
  ) {
    await this.access.project(userId, organizationId, projectId);
    return this.prisma.aiConversation.create({
      data: {
        organizationId: organizationId!,
        projectId,
        userId,
        title: dto.title?.trim() || 'New conversation',
        autoMemoryEnabled: dto.autoMemoryEnabled ?? true,
      },
    });
  }

  async get(userId: string, organizationId: string | undefined, conversationId: string) {
    const conversation = await this.access.conversation(userId, organizationId, conversationId);
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId, organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return { ...conversation, messages };
  }

  async update(
    userId: string,
    organizationId: string | undefined,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    const conversation = await this.access.conversation(userId, organizationId, conversationId);
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Only the conversation owner can modify it.');
    }
    return this.prisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.autoMemoryEnabled !== undefined
          ? { autoMemoryEnabled: dto.autoMemoryEnabled }
          : {}),
      },
    });
  }

  async respond(
    userId: string,
    organizationId: string | undefined,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.access.conversation(userId, organizationId, conversationId);
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Only the conversation owner can add messages.');
    }
    const redacted = redactSecrets(dto.content.trim());
    const userMessage = await this.prisma.aiMessage.create({
      data: {
        organizationId: organizationId!,
        conversationId,
        userId,
        role: AiMessageRole.USER,
        content: redacted.text,
        tokenEstimate: estimateTokens(redacted.text),
        metadataJson: redacted.redacted ? { secretsRedacted: true } : undefined,
      },
    });
    if (!this.provider.isConfigured()) {
      await this.jobs.afterMessage(conversationId, userMessage.id, conversation.projectId);
      throw new ServiceUnavailableException(
        'Your message was saved, but AI responses are disabled until the server AI provider is configured.',
      );
    }
    const context = await this.contextBuilder.build({
      userId,
      organizationId: organizationId!,
      conversationId,
      currentMessage: redacted.text,
      codeContext: dto.codeContext,
    });
    let response: string;
    try {
      response = await this.provider.generate(context.messages);
    } catch (error) {
      await this.jobs.afterMessage(conversationId, userMessage.id, conversation.projectId);
      apiLogger.warn(
        {
          conversationId,
          projectId: conversation.projectId,
          error: error instanceof Error ? error.message : String(error),
        },
        'ai_response_failed_message_preserved',
      );
      throw error;
    }
    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        organizationId: organizationId!,
        conversationId,
        role: AiMessageRole.ASSISTANT,
        content: response,
        tokenEstimate: estimateTokens(response),
        metadataJson: {
          provider: this.provider.providerName,
          model: this.provider.chatModel,
          contextTokenEstimate: context.tokenEstimate,
          retrievedMemoryIds: context.retrievedMemoryIds,
          contextSections: context.sections,
        },
      },
    });
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        ...(conversation.title === 'New conversation'
          ? { title: redacted.text.slice(0, 80) }
          : {}),
      },
    });
    await this.jobs.afterMessage(conversationId, userMessage.id, conversation.projectId);
    apiLogger.info(
      {
        conversationId,
        projectId: conversation.projectId,
        retrievedMemories: context.retrievedMemoryIds.length,
        contextTokens: context.tokenEstimate,
      },
      'ai_response_completed',
    );
    return { userMessage, assistantMessage, context: context.sections };
  }
}
