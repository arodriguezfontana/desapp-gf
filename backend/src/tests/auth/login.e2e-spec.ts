import * as request from 'supertest';
import { createTestApp, TestContext } from './test-app';

describe('POST /auth/login (e2e)', () => {
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
    await request(server())
      .post('/auth/register')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });
  });

  it('200 con accessToken, tokenType y expiresIn = 86400', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 86400,
    });

    const [, payloadB64] = (res.body.accessToken as string).split('.');
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64').toString('utf8'),
    ) as Record<string, unknown>;
    expect(payload.exp).toBeDefined();
    expect((payload.exp as number) - (payload.iat as number)).toBe(86400);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
  });

  it('email inexistente y contraseña incorrecta devuelven respuestas idénticas', async () => {
    const unknownEmail = await request(server())
      .post('/auth/login')
      .send({ email: 'nadie@mail.com', password: 'Abcd1234!' });

    const wrongPassword = await request(server())
      .post('/auth/login')
      .send({ email: 'ana@mail.com', password: 'Otra9$xyz' });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect({ ...unknownEmail.body, timestamp: 0, path: 0 }).toEqual({
      ...wrongPassword.body,
      timestamp: 0,
      path: 0,
    });
    expect(unknownEmail.body.message).toBe('Credenciales inválidas.');
  });

  it('400 si falta un campo', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: 'ana@mail.com' });
    expect(res.status).toBe(400);
  });

  it('funciona sin header Authorization', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });
    expect(res.status).toBe(200);
  });
});
