import { createTestApp, TestContext } from '../test-app';
import { compareAuditCoverage, HandlerAudit, listHandlerAudits } from './helpers/route-inventory';

/**
 * 028-structured-request-logging, User Story 5: todo handler de escritura (POST/PATCH/PUT/DELETE) declara su
 * operación de negocio con `@AuditedOperation`; un endpoint de escritura nuevo no puede quedar sin auditar por
 * olvido. Las lecturas no se auditan (FR-020).
 */
describe('Cobertura de la auditoría de negocio (e2e, spec 028 US5)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('todo handler de escritura publicado declara @AuditedOperation', () => {
    const handlers = listHandlerAudits(ctx.app);

    expect(handlers.length).toBeGreaterThan(0);
    expect(compareAuditCoverage(handlers).writesWithoutAudit).toEqual([]);
  });

  it('ninguna lectura declara @AuditedOperation', () => {
    expect(compareAuditCoverage(listHandlerAudits(ctx.app)).readsAudited).toEqual([]);
  });

  it('quedan auditadas las 16 operaciones de escritura del catálogo', () => {
    const audited = listHandlerAudits(ctx.app).filter((h) => h.audited).map((h) => h.id);

    expect(audited.sort()).toEqual(
      [
        'POST /orders',
        'DELETE /orders/:id',
        'POST /alerts',
        'DELETE /alerts/:id',
        'PATCH /notifications/:id/read',
        'PATCH /notifications/read-all',
        'PATCH /users/me/strategies/:id/select',
        'PATCH /users/me/strategies/:id/weights',
        'PATCH /users/me/strategies/:id/position-weights/:position',
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/api-key',
        'POST /quotes/recalculate',
        'POST /sync/whoscored',
        'POST /sync/football-data',
        'POST /admin/simulate-market',
      ].sort(),
    );
  });

  describe('meta-test: la verificación realmente falla ante una discrepancia', () => {
    const handlers: HandlerAudit[] = [
      { id: 'POST /a', method: 'POST', audited: true },
      { id: 'DELETE /b/:id', method: 'DELETE', audited: true },
      { id: 'GET /c', method: 'GET', audited: false },
    ];

    it('sin discrepancias no reporta nada', () => {
      expect(compareAuditCoverage(handlers)).toEqual({ writesWithoutAudit: [], readsAudited: [] });
    });

    it('una escritura sin @AuditedOperation se reporta', () => {
      const missing = handlers.map((h) => (h.id === 'DELETE /b/:id' ? { ...h, audited: false } : h));

      expect(compareAuditCoverage(missing).writesWithoutAudit).toEqual(['DELETE /b/:id']);
    });

    it('una lectura con @AuditedOperation se reporta', () => {
      const wrong = handlers.map((h) => (h.id === 'GET /c' ? { ...h, audited: true } : h));

      expect(compareAuditCoverage(wrong).readsAudited).toEqual(['GET /c']);
    });
  });
});
