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
    // Bearer-authenticated native/API clients do not rely on ambient cookies,
    // so they are not vulnerable to browser CSRF. License activation likewise
    // authenticates with the license itself rather than a browser session.
    if (
      req.headers.authorization?.startsWith('Bearer ') ||
      req.originalUrl?.startsWith('/api/v1/licenses/activate')
    ) {
      return true;
    }

    const allowedOriginsConfig = this.config.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000,http://localhost:5173,http://localhost:4000',
    );
    const allowedOrigins = new Set(
      allowedOriginsConfig
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try { return new URL(value).origin; } catch { return ''; }
        })
        .filter(Boolean),
    );

    const getOrigin = (value: string): string | null => {
      try { return new URL(value).origin; } catch { return null; }
    };

    if (origin) {
      const isAllowedOrigin = allowedOrigins.has(getOrigin(origin) || '');
      if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(`Untrusted origin: ${origin}`);
      }
      return true;
    }

    if (referer) {
      const isAllowedReferer = allowedOrigins.has(getOrigin(referer) || '');
      if (!isAllowedReferer && process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(`Untrusted referer: ${referer}`);
      }
      return true;
    }

    // In production, block cookie-authenticated mutations without Origin/Referer.
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'CSRF/Origin validation failed: Missing origin or validation headers.',
      );
    }

    return true;
  }
}
