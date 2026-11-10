import { Controller, Get } from '@nestjs/common';
import { DURATION_BUCKETS_SECONDS } from './request-metrics';
import { getSlaClass, Sla, SLA_CLASSES, SlaClassName, slaLatencyThresholdsSeconds } from './sla';

describe('SLA por endpoint', () => {
  describe('decorator @Sla', () => {
    @Controller('demo')
    class DemoController {
      @Get()
      @Sla('read')
      withSla(): string {
        return 'ok';
      }

      @Get('sin-sla')
      withoutSla(): string {
        return 'ok';
      }
    }

    it('guarda la clase en los metadatos del handler y getSlaClass la devuelve', () => {
      expect(getSlaClass(DemoController.prototype.withSla)).toBe('read');
    });

    it('un handler sin decorator no tiene clase de SLA', () => {
      expect(getSlaClass(DemoController.prototype.withoutSla)).toBeUndefined();
    });
  });

  describe('SLA_CLASSES', () => {
    it('define exactamente las clases de la spec', () => {
      expect(Object.keys(SLA_CLASSES).sort()).toEqual(
        [
          'auth',
          'market',
          'ping',
          'read',
          'read-computed',
          'stream',
          'system-long',
          'system-status',
          'system-trigger',
          'technical',
          'write',
        ].sort(),
      );
    });

    it('tiene los umbrales de latencia p95 (ms) de la tabla de la spec', () => {
      const p95: Record<SlaClassName, number | null> = {
        auth: 600,
        read: 300,
        'read-computed': 800,
        write: 500,
        market: 800,
        'system-trigger': 1000,
        'system-status': 300,
        'system-long': null,
        stream: null,
        ping: 100,
        technical: 250,
      };
      for (const [name, expected] of Object.entries(p95)) {
        expect({ name, p95Ms: SLA_CLASSES[name as SlaClassName].p95Ms }).toEqual({ name, p95Ms: expected });
      }
    });

    it('tiene la tasa máxima de 5xx de la spec: 0,5 % general y 1 % en las operaciones de sistema', () => {
      const oneTenth = new Set<SlaClassName>(['system-trigger', 'system-status', 'system-long']);
      for (const [name, sla] of Object.entries(SLA_CLASSES)) {
        expect({ name, maxErrorRate: sla.maxErrorRate }).toEqual({
          name,
          maxErrorRate: oneTenth.has(name as SlaClassName) ? 0.01 : 0.005,
        });
      }
    });

    it('sólo las operaciones de larga duración y el stream carecen de objetivo de latencia', () => {
      const withoutP95 = Object.entries(SLA_CLASSES)
        .filter(([, sla]) => sla.p95Ms === null)
        .map(([name]) => name)
        .sort();
      expect(withoutP95).toEqual(['stream', 'system-long']);
    });

    it('todo umbral de latencia coincide con un límite del histograma (FR-016)', () => {
      const thresholds = slaLatencyThresholdsSeconds();

      expect(thresholds.length).toBeGreaterThan(0);
      for (const threshold of thresholds) {
        expect(DURATION_BUCKETS_SECONDS).toContain(threshold);
      }
    });
  });
});
