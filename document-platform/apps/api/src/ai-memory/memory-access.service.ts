import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MemoryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMembership(userId: string, organizationId?: string) {
    if (!organizationId) throw new ForbiddenException('An active organization is required.');
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this organization.');
    return membership;
  }

  async assertCanWrite(userId: string, organizationId?: string) {
    const membership = await this.assertMembership(userId, organizationId);
    if (membership.role === OrgRole.VIEWER) {
      throw new ForbiddenException('Viewer members cannot modify project memory.');
    }
    return membership;
  }

  async project(userId: string, organizationId: string | undefined, projectId: string) {
    await this.assertMembership(userId, organizationId);
    const project = await this.prisma.aiProject.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) throw new NotFoundException('AI project not found.');
    return project;
  }

  async conversation(userId: string, organizationId: string | undefined, conversationId: string) {
    await this.assertMembership(userId, organizationId);
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, organizationId, userId },
      include: { project: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }
}
