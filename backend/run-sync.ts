import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PlayerSyncService } from './src/services/player-sync.service';

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const service = app.get(PlayerSyncService);
  console.log('=== INICIANDO SYNC REAL (5 ligas) ===');
  await service.sync();
  console.log('=== SYNC TERMINADA ===');
  await app.close();
})().catch((e) => {
  console.error('SYNC FAILED:', e);
  process.exit(1);
});
