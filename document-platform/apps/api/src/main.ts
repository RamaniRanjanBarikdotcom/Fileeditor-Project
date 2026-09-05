// ═══════════════════════════════════════════════════════════════
// AppToolkitLab — NestJS API Entry Point
// ═══════════════════════════════════════════════════════════════

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Respect the first reverse proxy (Next.js/nginx) so anonymous quotas use
  // the real client address instead of grouping every visitor under Docker's IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ─── Security ──────────────────────────────────────────────
  app.use(helmet());
  app.use(cookieParser());

  const corsOrigins = (
    process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:4000'
  )
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser requests or matching origins
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Toolsuite-Client',
      'Stripe-Signature',
      'X-Razorpay-Signature',
    ],
  });

  // ─── Global Pipes ─────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── API Prefix ───────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Swagger / OpenAPI ─────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('AppToolkitLab Platform API')
    .setDescription('Enterprise Multi-Tool, SaaS Subscription & Software Marketplace API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication, session & user verification endpoints')
    .addTag('feature-flags', 'Platform feature flag status')
    .addTag('tools', 'Server-authoritative tool registry & execution')
    .addTag('files', 'File upload and storage management')
    .addTag('conversions', 'Document conversion operations & quota management')
    .addTag('templates', 'Document templates')
    .addTag('presets', 'Conversion presets')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ─── Start Server ─────────────────────────────────────────
  const port = process.env.PORT || 4201;
  await app.listen(port);
  console.log(`🚀 AppToolkitLab API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
