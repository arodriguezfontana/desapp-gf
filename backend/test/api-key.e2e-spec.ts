import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ApiKeyEntity } from '../src/repositories/entities/api-key.entity';
import { createTestApp, TestContext } from './test-app';

describe('POST /auth/api-key (e2e)', () => {
  let ctx: TestContext;
  let jwt: JwtService;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string) => {
    await request(server())
      .post('/auth/register')
      .send({ email, password: 'Abcd1234!' });
    const res = await request(server())
      .post('/auth/login')
      .send({ email, password: 'Abcd1234!' });
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
    await ctx.dataSource.getRepository(ApiKeyEntity).clear();
    await ctx.clearUsers();
  });

  it('201: emite una ApiKey en texto plano para el usuario autenticado, persistiendo solo el hash', async () => {
    const token = await registerAndLogin('ana@mail.com');

    const res = await request(server())
      .post('/auth/api-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^pmk_[0-9a-f]{64}$/);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');

    const row = await ctx.dataSource
      .getRepository(ApiKeyEntity)
      .findOneByOrFail({ id: res.body.id });
    expect(row.keyHash).toHaveLength(64);
    expect(row.keyHash).not.toBe(res.body.apiKey);
    expect(row.revokedAt).toBeNull();
  });

  it('rota la clave: una segunda emisión invalida la primera de inmediato', async () => {
    const token = await registerAndLogin('rota@mail.com');

    const first = await request(server())
      .post('/auth/api-key')
      .set('Authorization', `Bearer ${token}`);
    const second = await request(server())
      .post('/auth/api-key')
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
    expect(first.body.apiKey).not.toBe(second.body.apiKey);

    const firstRow = await ctx.dataSource
      .getRepository(ApiKeyEntity)
      .findOneByOrFail({ id: first.body.id });
    const secondRow = await ctx.dataSource
      .getRepository(ApiKeyEntity)
      .findOneByOrFail({ id: second.body.id });
    expect(firstRow.revokedAt).not.toBeNull();
    expect(secondRow.revokedAt).toBeNull();
  });

  it('401 sin header Authorization, y no se crea ninguna ApiKey', async () => {
    const res = await request(server()).post('/auth/api-key');

    expect(res.status).toBe(401);
    expect(await ctx.dataSource.getRepository(ApiKeyEntity).count()).toBe(0);
  });

  it('401 con un token JWT malformado, y no se crea ninguna ApiKey', async () => {
    const res = await request(server())
      .post('/auth/api-key')
      .set('Authorization', 'Bearer no-es-un-jwt');

    expect(res.status).toBe(401);
    expect(await ctx.dataSource.getRepository(ApiKeyEntity).count()).toBe(0);
  });

  it('401 con un token JWT vencido, y no se crea ninguna ApiKey', async () => {
    const expired = jwt.sign({ sub: 'cualquier-id' }, { expiresIn: -60 });

    const res = await request(server())
      .post('/auth/api-key')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(await ctx.dataSource.getRepository(ApiKeyEntity).count()).toBe(0);
  });
});
