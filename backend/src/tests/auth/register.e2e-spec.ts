import * as request from 'supertest';
import { createTestApp, TestContext } from './test-app';

describe('POST /auth/register (e2e)', () => {
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

  it('201 y no devuelve accessToken', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({ email: 'ana@mail.com' }),
    );
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('funciona sin header Authorization', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'sinauth@mail.com', password: 'Abcd1234!' });
    expect(res.status).toBe(201);
  });

  it('409 si el email ya existe (case-insensitive)', async () => {
    await request(server())
      .post('/auth/register')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });

    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'Ana@Mail.com', password: 'Abcd1234!' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'El email ya está registrado.',
    });
  });

  it('400 si la contraseña incumple la política', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'bob@mail.com', password: 'password' });
    expect(res.status).toBe(400);
  });

  it('400 si el body trae un campo no declarado', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'c@mail.com', password: 'Abcd1234!', role: 'admin' });
    expect(res.status).toBe(400);
  });
});
