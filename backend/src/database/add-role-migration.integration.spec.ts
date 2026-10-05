import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { ApiKeyEntity } from '../repositories/api-key/entities/api-key.entity';
import { UserEntity } from '../repositories/auth/entities/user.entity';
import { DatabaseModule } from './database.module';
import { AddRoleToUsersAndApiKeys1790985600000 } from './migrations/1790985600000-AddRoleToUsersAndApiKeys';

/**
 * Este spec vive FUERA de `database/migrations/` a propósito: el runner de
 * migrations carga todo `migrations/*.{ts,js}`, y un spec de Jest ahí se
 * ejecutaría como migration en producción.
 */
describe('AddRoleToUsersAndApiKeys (migration, spec 008 US4)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  const migration = new AddRoleToUsersAndApiKeys1790985600000();

  const runWith = async (step: 'up' | 'down') => {
    const queryRunner = dataSource.createQueryRunner();
    try {
      await migration[step](queryRunner);
    } finally {
      await queryRunner.release();
    }
  };

  const roleOf = async (table: 'users' | 'api_keys', id: string): Promise<string> => {
    const rows: { role: string }[] = await dataSource.query(
      `SELECT role FROM "${table}" WHERE id = $1`,
      [id],
    );
    return rows[0].role;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      // forFeature registra las entidades: sin eso, `synchronize` no crea las tablas.
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity, ApiKeyEntity]),
      ],
    }).compile();
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    // Deja el esquema con la columna: el resto de las suites la necesita.
    await runWith('up');
    await moduleRef.close();
  });

  it('una fila legacy (sin columna role) queda con rol user tras la migration, y sigue activa', async () => {
    // Estado previo al cambio: las tablas no tienen la columna.
    await runWith('down');

    const userId = randomUUID();
    const keyId = randomUUID();
    await dataSource.query(
      `INSERT INTO "users" (id, email, password_hash) VALUES ($1, $2, 'hash-legacy')`,
      [userId, `legacy-${userId}@mail.com`],
    );
    await dataSource.query(
      `INSERT INTO "api_keys" (id, user_id, key_hash) VALUES ($1, $2, $3)`,
      [keyId, userId, `legacy-${keyId}`.padEnd(64, '0')],
    );

    await runWith('up');

    expect(await roleOf('users', userId)).toBe('user');
    expect(await roleOf('api_keys', keyId)).toBe('user');

    const [key]: { revoked_at: Date | null }[] = await dataSource.query(
      `SELECT revoked_at FROM "api_keys" WHERE id = $1`,
      [keyId],
    );
    expect(key.revoked_at).toBeNull();
  });

  it('es idempotente: correr up dos veces no falla ni cambia los roles', async () => {
    const userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "users" (id, email, password_hash, role) VALUES ($1, $2, 'h', 'admin')`,
      [userId, `idem-${userId}@mail.com`],
    );

    await expect(runWith('up')).resolves.toBeUndefined();

    expect(await roleOf('users', userId)).toBe('admin');
  });

  it('down elimina la columna y up la vuelve a crear', async () => {
    await runWith('down');
    const columns: { column_name: string }[] = await dataSource.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name IN ('users', 'api_keys') AND column_name = 'role'`,
    );
    expect(columns).toHaveLength(0);

    await runWith('up');
    const after: { column_name: string }[] = await dataSource.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name IN ('users', 'api_keys') AND column_name = 'role'`,
    );
    expect(after).toHaveLength(2);
  });
});
