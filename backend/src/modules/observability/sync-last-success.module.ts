import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncLastSuccessEntity } from '../../repositories/sync/entities/sync-last-success.entity';
import { SyncLastSuccessRepository } from '../../repositories/sync/sync-last-success.repository';
import { SyncLastSuccessService } from '../../services/observability/sync-last-success.service';
import { MetricsModule } from './metrics.module';

/**
 * Persistencia de la última sincronización exitosa por fuente (spec 031). Los módulos de sync lo importan
 * para registrar sus corridas exitosas; al arrancar siembra el gauge desde la tabla.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SyncLastSuccessEntity]), MetricsModule],
  providers: [SyncLastSuccessRepository, SyncLastSuccessService],
  exports: [SyncLastSuccessService],
})
export class SyncLastSuccessModule {}
