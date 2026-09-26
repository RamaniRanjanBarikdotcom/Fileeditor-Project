import { Injectable } from '@nestjs/common';
import { AiProjectStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { MemoryAccessService } from './memory-access.service';
import { CreateAiProjectDto, UpdateAiProjectDto } from './memory.dto';
import { MemoryJobsService } from './memory-jobs.service';

@Injectable()
export class AiProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MemoryAccessService,
    private readonly jobs: MemoryJobsService,
  ) {}

  async list(userId: string, organizationId?: string) {
    await this.access.assertMembership(userId, organizationId);
    return this.prisma.aiProject.findMany({
      where: { organizationId, status: AiProjectStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { conversations: true, memories: true } },
      },
    });
  }

  async create(userId: string, organizationId: string | undefined, dto: CreateAiProjectDto) {
    await this.access.assertCanWrite(userId, organizationId);
    return this.prisma.aiProject.create({
      data: {
        organizationId: organizationId!,
        createdByUserId: userId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async get(userId: string, organizationId: string | undefined, projectId: string) {
    const project = await this.access.project(userId, organizationId, projectId);
    const [memoryCounts, latestSummary] = await Promise.all([
      this.prisma.aiMemory.groupBy({
        by: ['status'],
        where: { organizationId, projectId },
        _count: { _all: true },
      }),
      this.prisma.aiSessionSummary.findFirst({
        where: { organizationId, projectId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { ...project, memoryCounts, latestSessionSummary: latestSummary };
  }

  async update(
    userId: string,
    organizationId: string | undefined,
    projectId: string,
    dto: UpdateAiProjectDto,
  ) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.access.project(userId, organizationId, projectId);
    return this.prisma.aiProject.update({
      where: { id: projectId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.memoryEnabled !== undefined ? { memoryEnabled: dto.memoryEnabled } : {}),
        ...(dto.autoExtractionEnabled !== undefined
          ? { autoExtractionEnabled: dto.autoExtractionEnabled }
          : {}),
      },
    });
  }

  async refreshSummary(userId: string, organizationId: string | undefined, projectId: string) {
    await this.access.assertCanWrite(userId, organizationId);
    await this.access.project(userId, organizationId, projectId);
    await this.jobs.refreshProject(projectId);
    return { queued: true };
  }

  async listSessionSummaries(
    userId: string,
    organizationId: string | undefined,
    projectId: string,
  ) {
    await this.access.project(userId, organizationId, projectId);
    return this.prisma.aiSessionSummary.findMany({
      where: { organizationId, projectId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { conversation: { select: { id: true, title: true } } },
    });
  }
}
