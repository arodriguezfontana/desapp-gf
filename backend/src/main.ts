import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { runPlayerCatalogMigrations } from './database/run-player-catalog-migrations';
import { AdminSeedService } from './services/auth/admin-seed.service';
import { SuperuserSeedService } from './services/auth/superuser-seed.service';
import { createCorsOptions } from './shared/cors-origins';
import { configureRequestLogging } from './shared/observability/logging/configure-request-logging';
import { createGlobalValidationPipe } from './shared/validation/global-validation-pipe';

async function bootstrap() {
  // bufferLogs: los logs previos a useLogger (arranque, rutas mapeadas) salen en JSON, no en texto plano.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Antes de listen/init: el middleware de logging debe quedar delante del body parser (spec 028).
  configureRequestLogging(app);

  // Corre después de que TypeOrmModule ya sincronizó el esquema (incluida la
  // tabla `players`) al construir la app. Ver research.md §2 de
  // 004-player-catalog: DataSource standalone, no toca database.module.ts.
  // Esta corrida también aplica la migration que agrega `role` (spec 008).
  await runPlayerCatalogMigrations();

  // Seed del primer admin (spec 008, US2). Va después de las migrations, para que
  // la columna `role` exista antes del insert, y antes de listen().
  await app.get(AdminSeedService, { strict: false }).run();

  // Seed del superusuario de mercado (020-order-matching-engine, spec FR-004).
  // Va despues del admin, mismo patron idempotente.
  await app.get(SuperuserSeedService, { strict: false }).run();

  app.enableCors(createCorsOptions(process.env.CORS_ORIGIN));

  app.useGlobalPipes(createGlobalValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Valoración de Mercado de Jugadores API')
    .setDescription(
      'API REST del sistema de valoración de mercado de jugadores de fútbol. ' +
        'Toda respuesta incluye el header X-Correlation-Id, que identifica la request en los logs; ' +
        'el cliente puede enviarlo para reutilizarlo en reintentos (1 a 64 caracteres: letras, números y . _ : -).',
    )
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
