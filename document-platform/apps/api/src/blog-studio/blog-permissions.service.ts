import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BlogPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkPermission(userId: string, organizationId: string, action: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        }
      },
      include: { user: { select: { platformRole: true } } },
    });

    if (!member) {
      return false;
    }

    // Platform administrators and organization administrators/owners can do everything.
    if (
      member.user.platformRole === PlatformRole.ADMIN ||
      member.role === 'ADMIN' ||
      member.role === 'OWNER'
    ) {
      return true;
    }

    // Fine-grained permission check could go here if roles are more complex.
    // For now, any member can access basic blog studio features, but maybe
    // only admins can manage providers and destinations.
    if (action.startsWith('manage:')) {
      return false; // Non-admins cannot manage settings
    }

    return true;
  }
}

@Injectable()
export class BlogStudioPermissionGuard implements CanActivate {
  constructor(private readonly permissionsService: BlogPermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // The authenticated JWT is the source of truth. A caller-controlled header
    // must never be able to switch the tenant used by an authorization check.
    const organizationId = user?.orgId;

    if (!user || !organizationId) {
      throw new ForbiddenException('User or Organization not identified.');
    }

    // Determine action from route/method, simplistic mapping for demo:
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const isSettings =
      request.url.includes('/providers') ||
      request.url.includes('/destinations') ||
      request.url.includes('/settings') ||
      request.url.includes('/prompts');
    
    let action = isWrite ? 'write' : 'read';
    if (isSettings && isWrite) {
      action = 'manage:settings';
    }

    const hasPermission = await this.permissionsService.checkPermission(
      user.userId ?? user.id,
      organizationId,
      action,
    );
    
    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions to perform action: ${action}`);
    }

    return true;
  }
}
