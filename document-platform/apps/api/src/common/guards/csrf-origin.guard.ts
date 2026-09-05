import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    // Safe idempotent methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Webhooks have dedicated raw body signature verification
    if (req.originalUrl?.startsWith('/api/v1/webhooks') || req.path?.startsWith('/webhooks')) {
      return true;
    }

    const origin = req.headers['origin'] as string | undefined;
    const referer = req.headers['referer'] as string | undefined;
    const requestedWith = req.headers['x-requested-with'] as string | undefined;
    const clientSecret = req.headers['x-toolsuite-client'] as string | undefined;

    // Allow requests with our custom application header
    if (
      requestedWith === 'AppToolkitLabApp' ||
      requestedWith === 'ToolSuiteApp' ||
      requestedWith === 'XMLHttpRequest' ||
      clientSecret
    ) {
      return true;
    }

    const allowedOriginsConfig = this.config.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000,http://localhost:5173,http://localhost:4000',
    );
    const allowedOrigins = allowedOriginsConfig.split(',').map((o) => o.trim());

    if (origin) {
      const isAllowedOrigin = allowedOrigins.some((allowed) => origin.startsWith(allowed));
      if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(`Untrusted origin: ${origin}`);
      }
      return true;
    }

    if (referer) {
      const isAllowedReferer = allowedOrigins.some((allowed) => referer.startsWith(allowed));
      if (!isAllowedReferer && process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(`Untrusted referer: ${referer}`);
      }
      return true;
    }

    // In production, block state mutations without Origin/Referer/Custom Header
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'CSRF/Origin validation failed: Missing origin or validation headers.',
      );
    }

    return true;
  }
}
