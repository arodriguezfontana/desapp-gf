import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { runPlayerCatalogMigrations } from './database/run-player-catalog-migrations';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Corre después de que TypeOrmModule ya sincronizó el esquema (incluida la
  // tabla `players`) al construir la app. Ver research.md §2 de
  // 004-player-catalog: DataSource standalone, no toca database.module.ts.
  await runPlayerCatalogMigrations();

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Valoración de Mercado de Jugadores API')
    .setDescription('API REST del sistema de valoración de mercado de jugadores de fútbol')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
      'ApiKeyAuth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
