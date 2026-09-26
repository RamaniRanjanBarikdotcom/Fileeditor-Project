import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates a bearer token when one is supplied, while allowing genuinely
 * anonymous requests through. Invalid or expired supplied credentials are not
 * silently downgraded to anonymous access.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
  ): TUser | null {
    const request = context.switchToHttp().getRequest();
    const suppliedAuthorization = Boolean(request.headers?.authorization);
    if (err || (suppliedAuthorization && (!user || info))) {
      throw err || new UnauthorizedException('The supplied access token is invalid or expired.');
    }
    return user || null;
  }
}
