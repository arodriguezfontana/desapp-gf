import * as request from 'supertest';
import { createTestApp, TestContext } from '../test-app';
import { BUILD_INFO } from '../../src/modules/observability/info.constants';
import { BuildInfo } from '../../src/shared/observability/info/build-info';

/**
 * `GET /info` (equivalente a `/actuator/info`): público, devuelve los datos del build y el uptime del
 * proceso, sin configuración ni secretos. `BUILD_INFO` se sobrescribe con valores conocidos.
 */
describe('Info del servicio (e2e)', () => {
  const build: BuildInfo = {
    name: 'backend',
    version: '1.2.3',
    commit: 'abc1234',
    environment: 'test',
    node: 'v22.0.0',
  };
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([{ token: BUILD_INFO, useValue: build }]);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('responde 200 sin credenciales con los datos del build, el arranque y el uptime', async () => {
    const res = await request(server()).get('/info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ...build,
      startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      uptimeSeconds: expect.any(Number),
    });
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('el arranque es el mismo entre consultas', async () => {
    const first = await request(server()).get('/info');
    const second = await request(server()).get('/info');

    expect(second.body.startedAt).toBe(first.body.startedAt);
  });

  it('no expone configuración ni secretos del entorno', async () => {
    const res = await request(server()).get('/info');

    expect(Object.keys(res.body).sort()).toEqual(
      ['commit', 'environment', 'name', 'node', 'startedAt', 'uptimeSeconds', 'version'].sort(),
    );
    for (const secret of [process.env.DATABASE_URL, process.env.JWT_SECRET].filter(Boolean) as string[]) {
      expect(res.text).not.toContain(secret);
    }
  });
});
