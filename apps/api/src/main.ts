/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
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

  // CORS
  await app.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200'],
    credentials: true,
  });

  // Security headers
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
  });

  // Rate limiting
  await app.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
  });

  // Cookies (for refresh tokens)
  await app.register(import('@fastify/cookie'), {
    secret: process.env.JWT_REFRESH_SECRET || 'change-me-in-production',
  });

  // Multipart (file uploads)
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
    },
  });

  const port = process.env.API_PORT || 3000;
  const host = process.env.API_HOST || '0.0.0.0';

  // Runs module cleanup on SIGTERM, so a restart stops sync timers and closes database pools.
  app.enableShutdownHooks();

  await app.listen({ port: Number(port), host });
  logger.log(`🚀 Paarvix API running on http://${host}:${port}`);
  logger.log(`📖 Health check: http://${host}:${port}/api/health`);
}

bootstrap();
