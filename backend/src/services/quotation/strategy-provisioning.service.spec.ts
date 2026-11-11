import { SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { StrategyProvisioningService } from './strategy-provisioning.service';

const POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;

describe('StrategyProvisioningService (unit, con dobles, sin Nest ni DB)', () => {
  let strategies: ValuationStrategy[];

  beforeEach(async () => {
    const repository = {
      saveMany: jest.fn(async (toSave: ValuationStrategy[]) => toSave),
    };
    const service = new StrategyProvisioningService(
      repository as unknown as ValuationStrategyRepository,
      new SequentialIdGenerator('strategy'),
    );

    strategies = await service.provisionDefaultStrategiesFor('user-1');
  });

  const byName = (name: string): ValuationStrategy => strategies.find((s) => s.name === name)!;

  const sumOf = (weights: Record<string, number>): number =>
    Object.values(weights).reduce((acc, w) => acc + w, 0);

  it('crea las dos estrategias del usuario, con "Performance general" seleccionada', () => {
    expect(strategies.map((s) => s.name).sort()).toEqual(['Impacto táctico', 'Performance general']);
    expect(byName('Performance general').isSelected).toBe(true);
    expect(byName('Impacto táctico').isSelected).toBe(false);
    expect(strategies.every((s) => s.userId === 'user-1' && s.factorEscala === 99)).toBe(true);
  });

  it.each(['Performance general', 'Impacto táctico'])(
    '"%s": los pesos generales y los 4 perfiles de posición suman 1.0 ±0.001',
    (name) => {
      const strategy = byName(name);

      expect(sumOf(strategy.weights)).toBeCloseTo(1.0, 3);
      for (const position of POSITIONS) {
        const profile = strategy.positionWeights[position];
        expect(profile).toBeDefined();
        expect(sumOf(profile!)).toBeCloseTo(1.0, 3);
      }
    },
  );

  it('"Impacto táctico" trae los perfiles de posición vigentes', () => {
    expect(byName('Impacto táctico').positionWeights).toEqual({
      FW: {
        goals: 0.25,
        assists: 0.3,
        shots: 0.1,
        keyPasses: 0.2,
        totalTackles: 0.15,
        rating: 0.2,
        yellowCards: -0.05,
        redCards: -0.15,
      },
      MF: {
        assists: 0.25,
        keyPasses: 0.25,
        totalTackles: 0.2,
        passesCompleted: 0.3,
        rating: 0.2,
        yellowCards: -0.05,
        redCards: -0.15,
      },
      DF: { totalTackles: 0.45, interceptions: 0.45, rating: 0.3, yellowCards: -0.05, redCards: -0.15 },
      GK: { interceptions: 0.2, passesCompleted: 0.65, rating: 0.35, yellowCards: -0.05, redCards: -0.15 },
    });
  });
});
