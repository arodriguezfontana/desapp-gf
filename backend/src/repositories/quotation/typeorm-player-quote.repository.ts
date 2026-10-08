import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { PlayerQuoteRepository } from './player-quote.repository';
import { PlayerQuoteEntity } from './entities/player-quote.entity';
import { PlayerQuoteMapper } from './player-quote.mapper';

@Injectable()
export class TypeOrmPlayerQuoteRepository implements PlayerQuoteRepository {
  constructor(
    @InjectRepository(PlayerQuoteEntity)
    private readonly repo: Repository<PlayerQuoteEntity>,
    private readonly mapper: PlayerQuoteMapper,
  ) {}

  async saveMany(quotes: PlayerQuote[]): Promise<void> {
    if (quotes.length === 0) return;
    await this.repo.insert(quotes.map((q) => this.mapper.toPersistence(q)));
  }

  async findLatestByPlayerId(playerId: string): Promise<PlayerQuote | null> {
    const entity = await this.repo.findOne({
      where: { playerId },
      order: { calculatedAt: 'DESC' },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }
}
