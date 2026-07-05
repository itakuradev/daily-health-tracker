import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });

  // リクエストボディのバリデーション（DTO デコレーターを有効化）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // DTO に存在しないフィールドを自動除去
      forbidNonWhitelisted: false,
      transform: true,        // 型を自動変換 (string → number 等)
    }),
  );

  // 統一エラーレスポンスフィルター
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('健康管理マスター API')
    .setDescription('食事・体調・筋トレ記録の REST API')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-User-Id', description: '開発用ユーザーID（例: 1）' },
      'X-User-Id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
  console.log(`Swagger UI:      http://localhost:${port}/api-docs`);
}
bootstrap();
