import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { Transaction } from '../shared/transaction';
import { TokenHoldingEntity } from './entities/token-holding.entity';
import { TokenHoldingMapper } from './mappers/token-holding.mapper';

@Injectable()
export class TokenHoldingRepository {
  constructor(
    @InjectRepository(TokenHoldingEntity)
    private readonly repo: Repository<TokenHoldingEntity>,
    private readonly mapper: TokenHoldingMapper,
  ) {}

  async findByUserId(userId: string): Promise<TokenHolding[]> {
    const entities = await this.repo.find({ where: { userId } });
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async findByUserAndPlayer(userId: string, playerId: string): Promise<TokenHolding | null> {
    const entity = await this.repo.findOne({ where: { userId, playerId } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(holding: TokenHolding): Promise<TokenHolding> {
    await this.repo.save(this.mapper.toEntity(holding));
    return holding;
  }

  async lockForUpdate(tx: Transaction, userId: string, playerId: string): Promise<TokenHolding> {
    const repo = tx.manager.getRepository(TokenHoldingEntity);
    const lock = () =>
      repo
        .createQueryBuilder('h')
        .setLock('pessimistic_write')
        .where('h.user_id = :userId', { userId })
        .andWhere('h.player_id = :playerId', { playerId })
        .getOne();

    let entity = await lock();
    if (!entity) {
      // Bootstrap: puede competir con otra transaccion concurrente creando el
      // mismo holding por primera vez. ON CONFLICT DO NOTHING absorbe esa
      // carrera; el re-select posterior, ya con lock, trae la fila
      // (propia o de quien ganó) de forma segura.
      await tx.manager.query(
        `INSERT INTO "token_holdings" ("id", "user_id", "player_id", "quantity", "updated_at")
         VALUES ($1, $2, $3, 0, now())
         ON CONFLICT ("user_id", "player_id") DO NOTHING`,
        [randomUUID(), userId, playerId],
      );
      entity = await lock();
    }

    return this.mapper.toDomain(entity!);
  }

  async saveInTransaction(tx: Transaction, holding: TokenHolding): Promise<TokenHolding> {
    await tx.manager.getRepository(TokenHoldingEntity).save(this.mapper.toEntity(holding));
    return holding;
  }
}
