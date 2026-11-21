import { BusinessMetricsService } from './business-metrics.service';
import { MetricsService } from './metrics.service';

describe('BusinessMetricsService — último recálculo de cotizaciones', () => {
  let metrics: MetricsService;
  let business: BusinessMetricsService;

  beforeEach(() => {
    metrics = new MetricsService();
    business = new BusinessMetricsService(metrics);
  });

  it('vale 0 hasta que hay un recálculo exitoso: 0 significa "ninguno", nunca un momento falso', async () => {
    const text = await metrics.render();

    expect(text).toContain('# TYPE quote_last_recalculation_timestamp_seconds gauge');
    expect(text).toMatch(/^quote_last_recalculation_timestamp_seconds 0$/m);
  });

  it('setQuoteLastRecalculation fija el gauge en segundos Unix', async () => {
    business.setQuoteLastRecalculation(new Date('2026-11-15T03:00:00.000Z'));

    expect(await metrics.render()).toContain(
      `quote_last_recalculation_timestamp_seconds ${Date.parse('2026-11-15T03:00:00.000Z') / 1000}`,
    );
  });

  it('un nuevo recálculo reemplaza el valor anterior', async () => {
    business.setQuoteLastRecalculation(new Date('2026-11-08T03:00:00.000Z'));
    business.setQuoteLastRecalculation(new Date('2026-11-15T03:00:00.000Z'));

    const text = await metrics.render();
    expect(text).toContain(`quote_last_recalculation_timestamp_seconds ${Date.parse('2026-11-15T03:00:00.000Z') / 1000}`);
    expect(text.match(/^quote_last_recalculation_timestamp_seconds /gm)).toHaveLength(1);
  });

  it('nunca lanza, aunque la fecha sea inválida', () => {
    expect(() => business.setQuoteLastRecalculation(new Date('no es una fecha'))).not.toThrow();
  });

  it('el HELP aclara que incluye la simulación de mercado y que se siembra al arrancar', async () => {
    expect(await metrics.render()).toMatch(/# HELP quote_last_recalculation_timestamp_seconds .*simulación de mercado.*arrancar.*vale 0/);
  });
});
