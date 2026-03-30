import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  // urlencoded must be enabled before NestFactory bootstraps so Paynow webhook
  // bodies (application/x-www-form-urlencoded) are parsed into req.body
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mall263 API')
    .setDescription('Mall263 Marketplace + POS Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // DO App Platform injects PORT at runtime — it must take priority over config defaults.
  // Bind to 0.0.0.0 so the platform's health-check router can reach the app.
  const port = parseInt(process.env.PORT || config.get('PORT', '4000'), 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Mall263 API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
