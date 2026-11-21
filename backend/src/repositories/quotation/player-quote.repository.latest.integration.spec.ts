import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../database/database.module';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { UserEntity } from '../auth/entities/user.entity';
import { PlayerQuoteEntity } from './entities/player-quote.entity';
import { PlayerQuoteMapper } from './player-quote.mapper';
import { PlayerQuoteRepository } from './player-quote.repository';

/**
 * No vacía la tabla (otros tests y datos pueden convivir): usa fechas de un futuro lejano para que sus cotizaciones
 * sean siempre las más recientes y limpia sólo lo que insertó. El caso "sin cotizaciones" se cubre con un doble en
 * `quotation.service.last-recalculation.spec.ts`.
 */
describe('PlayerQuoteRepository.findLatestCalculatedAt (integración, spec 031)', () => {
  let moduleRef: TestingModule;
  let repo: PlayerQuoteRepository;
  let dataSource: DataSource;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerQuoteEntity, UserEntity]),
      ],
      providers: [PlayerQuoteMapper, PlayerQuoteRepository],
    }).compile();
    repo = moduleRef.get(PlayerQuoteRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    userId = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id: userId,
      email: `${userId}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });
  });

  afterEach(async () => {
    await repo.deleteAllByUserId(userId);
    await dataSource.getRepository(UserEntity).delete({ id: userId });
  });

  const quote = (calculatedAt: string): PlayerQuote =>
    PlayerQuote.restore({
      id: randomUUID(),
      userId,
      playerId: randomUUID(),
      strategyId: randomUUID(),
      weightSnapshot: { goals: 0.25 },
      factorEscalaSnapshot: 99,
      score: 0.5,
      value: 50,
      calculatedAt: new Date(calculatedAt),
    });

  it('devuelve el momento de la cotización más reciente, sin importar el orden de inserción', async () => {
    await repo.saveMany([quote('2099-11-08T03:00:00.000Z'), quote('2099-11-15T03:00:00.000Z'), quote('2099-11-01T03:00:00.000Z')]);

    expect(await repo.findLatestCalculatedAt()).toEqual(new Date('2099-11-15T03:00:00.000Z'));
  });

  it('un instante posterior pasa a ser el nuevo último', async () => {
    await repo.saveMany([quote('2099-11-15T03:00:00.000Z')]);
    await repo.saveMany([quote('2099-11-22T03:00:00.000Z')]);

    expect(await repo.findLatestCalculatedAt()).toEqual(new Date('2099-11-22T03:00:00.000Z'));
  });
});
