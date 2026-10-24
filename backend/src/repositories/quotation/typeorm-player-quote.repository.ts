import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { PlayerQuoteRepository } from './player-quote.repository';
import { PlayerQuoteEntity } from './entities/player-quote.entity';
import { PlayerQuoteMapper } from './player-quote.mapper';

/**
 * Postgres rechaza un INSERT con más de 65535 parámetros bindeados en total
 * (columnas × filas): con el catálogo y la base de usuarios crecidos, un
 * único `insert()` sobre todas las combinaciones usuario+jugador de un
 * recálculo global supera ese límite y el driver falla con un error de
 * protocolo (bind message). `PlayerQuoteEntity` tiene 10 columnas, así que
 * 500 filas por lote deja un margen amplio (5000 parámetros) sin acercarse
 * al límite ni generar lotes excesivamente chicos.
 */
const INSERT_BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

@Injectable()
export class TypeOrmPlayerQuoteRepository implements PlayerQuoteRepository {
  constructor(
    @InjectRepository(PlayerQuoteEntity)
    private readonly repo: Repository<PlayerQuoteEntity>,
    private readonly mapper: PlayerQuoteMapper,
  ) {}

  async saveMany(quotes: PlayerQuote[]): Promise<void> {
    if (quotes.length === 0) return;
    const entities = quotes.map((q) => this.mapper.toPersistence(q));
    for (const batch of chunk(entities, INSERT_BATCH_SIZE)) {
      await this.repo.insert(batch);
    }
  }

  async findAllByPlayerIdAndUserId(playerId: string, userId: string): Promise<PlayerQuote[]> {
    const entities = await this.repo.find({
      where: { playerId, userId },
      order: { calculatedAt: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
