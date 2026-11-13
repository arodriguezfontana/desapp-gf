import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncLastSuccess, SyncSourceId } from '../../domain/sync/sync-last-success';
import { SyncLastSuccessEntity } from './entities/sync-last-success.entity';

/** Última sincronización exitosa por fuente (spec 031). Recibe y devuelve objetos de dominio. */
@Injectable()
export class SyncLastSuccessRepository {
  constructor(
    @InjectRepository(SyncLastSuccessEntity)
    private readonly repo: Repository<SyncLastSuccessEntity>,
  ) {}

  /** Una fila por fuente que alguna vez tuvo una corrida exitosa. */
  async findAll(): Promise<SyncLastSuccess[]> {
    const entities = await this.repo.find();
    return entities.map((entity) => ({ source: entity.source as SyncSourceId, succeededAt: entity.succeededAt }));
  }

  /** Crea o reemplaza la fila de la fuente. */
  async upsert(source: SyncSourceId, succeededAt: Date): Promise<void> {
    await this.repo.upsert({ source, succeededAt }, ['source']);
  }
}
