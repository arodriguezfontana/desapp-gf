import * as request from 'supertest';
import { createTestApp, TestContext } from './test-app';

/**
 * 020-order-matching-engine, Historia 1 (spec FR-001 a FR-003, SC-001).
 */
describe('POST /auth/register — username reservado (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.clearUsers();
  });

  it('409 si se intenta registrar con username = "superuser", sin crear ninguna cuenta', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'intruso@mail.com', password: 'Abcd1234!', username: 'superuser' });

    expect(res.status).toBe(409);

    const rows = await ctx.dataSource.query(
      'SELECT * FROM "users" WHERE "email" = $1',
      ['intruso@mail.com'],
    );
    expect(rows).toHaveLength(0);
  });

  it('400 si falta el campo username', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'sinusername@mail.com', password: 'Abcd1234!' });

    expect(res.status).toBe(400);
  });

  it('permite que dos usuarios distintos se registren con el mismo username no reservado', async () => {
    const first = await request(server())
      .post('/auth/register')
      .send({ email: 'user1@mail.com', password: 'Abcd1234!', username: 'inversor' });
    const second = await request(server())
      .post('/auth/register')
      .send({ email: 'user2@mail.com', password: 'Abcd1234!', username: 'inversor' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const rows = await ctx.dataSource.query(
      'SELECT "email" FROM "users" WHERE "username" = $1 ORDER BY "email" ASC',
      ['inversor'],
    );
    expect(rows).toHaveLength(2);
  });

  it('acepta un username que se parece pero no es exactamente "superuser"', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'parecido@mail.com', password: 'Abcd1234!', username: 'Superuser' });

    expect(res.status).toBe(201);
  });
});
