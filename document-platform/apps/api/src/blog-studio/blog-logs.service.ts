import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BlogLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogs(organizationId: string, limit = 50, offset = 0) {
    const safeLimit = Math.min(200, Math.max(1, limit));
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      OR: [
        { action: { startsWith: 'BLOG_' } },
        { resourceType: { startsWith: 'Blog' } },
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Math.max(0, offset),
        take: safeLimit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        level: /FAILED|ERROR|REJECTED/i.test(item.action) ? 'error' : 'info',
        category: item.resourceType || 'Blog Studio',
        message: item.action
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        detailsJson: item.metadataJson,
        blogId: item.resourceType === 'BlogDocument' ? item.resourceId : undefined,
      })),
      total,
      limit: safeLimit,
      offset: Math.max(0, offset),
    };
  }

  createActivityLog(
    organizationId: string,
    userId: string,
    action: string,
    type: string,
    metadata?: Record<string, unknown>,
    request?: { ip?: string; userAgent?: string; resourceId?: string },
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: type,
        resourceId: request?.resourceId,
        metadataJson: metadata as Prisma.InputJsonValue | undefined,
        ipAddress: request?.ip,
        userAgent: request?.userAgent,
      },
    });
  }
}
