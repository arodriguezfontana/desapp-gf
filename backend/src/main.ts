import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { runPlayerCatalogMigrations } from './database/run-player-catalog-migrations';
import { AdminSeedService } from './services/auth/admin-seed.service';
import { createGlobalValidationPipe } from './shared/validation/global-validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Corre después de que TypeOrmModule ya sincronizó el esquema (incluida la
  // tabla `players`) al construir la app. Ver research.md §2 de
  // 004-player-catalog: DataSource standalone, no toca database.module.ts.
  // Esta corrida también aplica la migration que agrega `role` (spec 008).
  await runPlayerCatalogMigrations();

  // Seed del primer admin (spec 008, US2). Va después de las migrations, para que
  // la columna `role` exista antes del insert, y antes de listen().
  await app.get(AdminSeedService, { strict: false }).run();

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(createGlobalValidationPipe());

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
