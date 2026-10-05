import * as request from 'supertest';
import { ApiKeyEntity } from '../src/repositories/api-key/entities/api-key.entity';
import { UserEntity } from '../src/repositories/auth/entities/user.entity';
import { createTestApp, TestContext } from './test-app';

describe('Rol de usuario (e2e, spec 008)', () => {
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

  describe('US1: alta con rol user', () => {
    it('400 si el body intenta indicar role (el alta no declara ese campo)', async () => {
      const res = await request(server())
        .post('/auth/register')
        .send({ email: 'ana@mail.com', password: 'Abcd1234!', role: 'admin' });

      expect(res.status).toBe(400);
    });

    it('la cuenta nueva tiene rol user en GET /auth/me', async () => {
      await request(server())
        .post('/auth/register')
        .send({ email: 'ana@mail.com', password: 'Abcd1234!' })
        .expect(201);

      const login = await request(server())
        .post('/auth/login')
        .send({ email: 'ana@mail.com', password: 'Abcd1234!' })
        .expect(200);

      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(me.body).toMatchObject({ email: 'ana@mail.com', role: 'user' });
    });
  });

  describe('US3: la ApiKey copia el rol de quien la emitió', () => {
    const registerAndLogin = async (email: string): Promise<{ token: string; userId: string }> => {
      await request(server())
        .post('/auth/register')
        .send({ email, password: 'Abcd1234!' })
        .expect(201);
      const login = await request(server())
        .post('/auth/login')
        .send({ email, password: 'Abcd1234!' })
        .expect(200);
      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      return { token: login.body.accessToken, userId: me.body.id };
    };

    const issue = (token: string) =>
      request(server()).post('/auth/api-key').set('Authorization', `Bearer ${token}`);

    const rowFor = (id: string) =>
      ctx.dataSource.getRepository(ApiKeyEntity).findOneByOrFail({ id });

    it('un usuario con rol user emite una clave con rol user', async () => {
      const { token } = await registerAndLogin('ana@mail.com');

      const res = await issue(token).expect(201);

      expect((await rowFor(res.body.id)).role).toBe('user');
    });

    it('el cambio de rol por SQL no toca la clave ya emitida; la rotación toma el rol nuevo', async () => {
      const { token, userId } = await registerAndLogin('ana@mail.com');
      const first = await issue(token).expect(201);

      // Cambio de rol directo en base: única vía en esta feature (riesgo aceptado).
      await ctx.dataSource
        .getRepository(UserEntity)
        .update({ id: userId }, { role: 'admin' });

      // La clave previa conserva su rol de emisión.
      expect((await rowFor(first.body.id)).role).toBe('user');

      // La rotación toma el rol vigente y revoca la anterior.
      const second = await issue(token).expect(201);
      const newRow = await rowFor(second.body.id);
      const oldRow = await rowFor(first.body.id);

      expect(newRow.role).toBe('admin');
      expect(oldRow.revokedAt).not.toBeNull();
      expect(newRow.revokedAt).toBeNull();
    });
  });
});
