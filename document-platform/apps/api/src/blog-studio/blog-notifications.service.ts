import { Injectable } from '@nestjs/common';
import type { BlogNotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BlogNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string, userId: string, unreadOnly = false) {
    return this.prisma.blogNotification.findMany({
      where: {
        organizationId,
        OR: [{ userId }, { userId: null }],
        ...(unreadOnly && { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(organizationId: string, userId: string, notificationId: string) {
    const result = await this.prisma.blogNotification.updateMany({
      where: { id: notificationId, organizationId, OR: [{ userId }, { userId: null }] },
      data: { readAt: new Date() },
    });
    return { updated: result.count === 1 };
  }

  notifyJobComplete(organizationId: string, userId: string, blogId: string) {
    return this.create(
      organizationId,
      userId,
      'GENERATION_COMPLETE',
      'Blog ready',
      'Your generated article is ready to edit and export.',
      'BlogDocument',
      blogId,
    );
  }

  notifyJobFailed(organizationId: string, userId: string, errorMsg: string) {
    return this.create(
      organizationId,
      userId,
      'GENERATION_FAILED',
      'Generation failed',
      errorMsg.slice(0, 500),
      'BlogGenerationJob',
    );
  }

  notifyPublishSuccess(
    organizationId: string,
    userId: string,
    destinationId: string,
    url: string,
  ) {
    return this.create(
      organizationId,
      userId,
      'PUBLISH_SUCCESS',
      'Article published',
      `The remote platform accepted the article: ${url}`,
      'BlogDestination',
      destinationId,
    );
  }

  notifyPublishFailed(
    organizationId: string,
    userId: string,
    destinationId: string,
    errorMsg: string,
  ) {
    return this.create(
      organizationId,
      userId,
      'PUBLISH_FAILED',
      'Publishing failed',
      errorMsg.slice(0, 500),
      'BlogDestination',
      destinationId,
    );
  }

  private create(
    organizationId: string,
    userId: string | null,
    type: BlogNotificationType,
    title: string,
    message: string,
    resourceType?: string,
    resourceId?: string,
  ) {
    return this.prisma.blogNotification.create({
      data: { organizationId, userId, type, title, message, resourceType, resourceId },
    });
  }
}
