import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestContext } from './test-app';

describe('Endpoints protegidos con JWT (e2e)', () => {
  let ctx: TestContext;
  let jwt: JwtService;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async () => {
    await request(server())
      .post('/auth/register')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });
    const res = await request(server())
      .post('/auth/login')
      .send({ email: 'ana@mail.com', password: 'Abcd1234!' });
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    jwt = ctx.app.get(JwtService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.clearUsers();
  });

  it('200 con un JWT válido, devolviendo la identidad del dueño', async () => {
    const token = await registerAndLogin();
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), email: 'ana@mail.com' });
  });

  it('401 sin header Authorization', async () => {
    const res = await request(server()).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No autenticado.');
  });

  it('401 con un token malformado', async () => {
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', 'Bearer no-es-un-jwt');
    expect(res.status).toBe(401);
  });

  it('401 con un token vencido', async () => {
    const expired = jwt.sign({ sub: 'cualquier-id' }, { expiresIn: -60 });
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('401 con un JWT válido de un usuario que ya no existe', async () => {
    const token = await registerAndLogin();
    await ctx.clearUsers();
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('GET / y GET /health siguen respondiendo sin token', async () => {
    expect((await request(server()).get('/')).status).toBe(200);
    expect((await request(server()).get('/health')).status).toBe(200);
  });
});
