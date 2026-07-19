import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * 環境変数 CORS_ORIGIN からオリジンのリストを生成する。
 * カンマ区切りで複数指定可能。例: "http://localhost:5173,http://localhost:5174"
 */
function parseCorsOrigins(raw: string | undefined): string | string[] {
  const fallback = 'http://localhost:5173';
  if (!raw) return fallback;
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('健康管理マスター API')
      .setDescription('食事・体調・筋トレ記録の REST API')
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cognito が発行した Access Token',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
  if (process.env.ENABLE_SWAGGER === 'true') {
    console.log(`Swagger UI:      http://localhost:${port}/api-docs`);
  }
}
bootstrap();
