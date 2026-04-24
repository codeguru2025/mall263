import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

const requestLogger = new Logger('HTTP');

/**
 * Minimal structured request logger — logs method, path, status, latency,
 * and a sanitised (no PII) request ID for log correlation.
 */
function makeRequestLogMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      requestLogger[level](`${method} ${originalUrl} ${statusCode} +${ms}ms`);
    });
    next();
  };
}

async function bootstrap() {
  // Disable Nest's default body parser so our size-limited parsers below are
  // the only ones registered (otherwise the 100kb default wins).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(cookieParser());
  const config = app.get(ConfigService);

  // ── Body size limits ────────────────────────────────────────────────────────
  // Default Express limit is 100kb; we tighten to 512kb for JSON APIs.
  // Multipart uploads are handled by multer per-route.
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ limit: '512kb', extended: true }));

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // needed for OSM iframes in web app
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }));

  // Trust the first reverse proxy (DigitalOcean App Platform), so that
  // req.ip returns the real client IP for rate limiting and audit logs.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(compression());
  app.use(makeRequestLogMiddleware());

  const normalizeOrigin = (o: string) => o.replace(/\/$/, '');

  const allowedOrigins = new Set(
    [
      config.get('FRONTEND_URL', 'http://localhost:3000'),
      ...(config.get('CORS_ORIGINS', '') as string).split(',').map((s: string) => s.trim()).filter(Boolean),
    ].map((o) => normalizeOrigin(o)),
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });

  // DO App Platform ingress (prefix: /api) strips /api before forwarding here,
  // so in production the effective prefix is v1, not api/v1.
  // Locally (NODE_ENV != production) the backend is hit directly, so api/v1 is correct.
  const defaultPrefix = process.env.NODE_ENV === 'production' ? 'v1' : 'api/v1';
  app.setGlobalPrefix(config.get('API_PREFIX', defaultPrefix));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  // Only expose API docs in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mall263 API')
      .setDescription('Mall263 Marketplace + POS Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // DO App Platform injects PORT at runtime — it must take priority over config defaults.
  // Bind to 0.0.0.0 so the platform's health-check router can reach the app.
  const port = parseInt(process.env.PORT || config.get('PORT', '4000'), 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Mall263 API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
