// ═══════════════════════════════════════════════════════════════
// Logging — Pino-based structured JSON logging
// ═══════════════════════════════════════════════════════════════

import pino from 'pino';

// ─── Configuration ───────────────────────────────────────────

export interface LoggerConfig {
  level?: string;
  pretty?: boolean;
  serviceName: string;
}

// ─── Create Logger ───────────────────────────────────────────

export function createLogger(config: LoggerConfig): pino.Logger {
  const { level = 'info', pretty = process.env['NODE_ENV'] === 'development', serviceName } = config;

  const options: pino.LoggerOptions = {
    level,
    name: serviceName,
    // Redact sensitive fields — never log file contents or secrets
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'passwordHash',
        'token',
        'refreshToken',
        'apiKey',
        'secret',
        'fileContent',
        'documentContent',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

// ─── Child Logger Helpers ────────────────────────────────────

export function withRequestId(logger: pino.Logger, requestId: string): pino.Logger {
  return logger.child({ requestId });
}

export function withJobId(logger: pino.Logger, jobId: string): pino.Logger {
  return logger.child({ jobId });
}

export function withUserId(logger: pino.Logger, userId: string): pino.Logger {
  return logger.child({ userId });
}

export function withOrgId(logger: pino.Logger, organizationId: string): pino.Logger {
  return logger.child({ organizationId });
}

// ─── Pre-configured Loggers ─────────────────────────────────

export const apiLogger = createLogger({
  serviceName: 'docconv-api',
  level: process.env['LOG_LEVEL'] || 'info',
});

export const workerLogger = createLogger({
  serviceName: 'docconv-worker',
  level: process.env['LOG_LEVEL'] || 'info',
});

export type { Logger } from 'pino';
