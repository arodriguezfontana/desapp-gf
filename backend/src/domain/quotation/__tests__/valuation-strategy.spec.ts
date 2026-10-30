import { InvalidStrategyWeightsError } from '../errors/invalid-strategy-weights.error';
import { ValuationStrategy } from '../valuation-strategy';

const VALID_WEIGHTS = {
  goals: 0.25,
  assists: 0.15,
  shots: 0.10,
  keyPasses: 0.10,
  dribbles: 0.10,
  totalTackles: 0.10,
  rating: 0.20,
};

describe('ValuationStrategy', () => {
  describe('create()', () => {
    it('crea correctamente una estrategia válida', () => {
      const strategy = ValuationStrategy.create({
        id: 'id-1',
        userId: 'user-1',
        name: 'Performance general',
        weights: VALID_WEIGHTS,
        factorEscala: 99,
        isSelected: true,
      });

      expect(strategy.id).toBe('id-1');
      expect(strategy.name).toBe('Performance general');
      expect(strategy.factorEscala).toBe(99);
      expect(strategy.isSelected).toBe(true);
    });

    it('acepta pesos negativos si la suma algebraica es 1.0', () => {
      const weightsWithNegative = {
        totalTackles: 0.25,
        interceptions: 0.20,
        passesCompleted: 0.20,
        assists: 0.20,
        keyPasses: 0.15,
        rating: 0.20,
        yellowCards: -0.05,
        redCards: -0.15,
      };

      expect(() =>
        ValuationStrategy.create({
          id: 'id-2',
          userId: 'user-1',
          name: 'Impacto táctico',
          weights: weightsWithNegative,
          factorEscala: 99,
          isSelected: false,
        }),
      ).not.toThrow();
    });

    it('lanza InvalidStrategyWeightsError si suma > 1.001', () => {
      const badWeights = { goals: 0.6, assists: 0.6 };

      expect(() =>
        ValuationStrategy.create({
          id: 'id-3',
          userId: 'user-1',
          name: 'Bad',
          weights: badWeights,
          factorEscala: 99,
          isSelected: false,
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });

    it('lanza InvalidStrategyWeightsError si suma < 0.999', () => {
      const badWeights = { goals: 0.3, assists: 0.3 };

      expect(() =>
        ValuationStrategy.create({
          id: 'id-4',
          userId: 'user-1',
          name: 'Bad',
          weights: badWeights,
          factorEscala: 99,
          isSelected: false,
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });

    it('tolera suma exactamente en el límite superior (0.999)', () => {
      // goals=0.5, assists=0.499 → suma = 0.999
      expect(() =>
        ValuationStrategy.create({
          id: 'id-5',
          userId: 'user-1',
          name: 'Edge',
          weights: { goals: 0.5, assists: 0.499 },
          factorEscala: 1,
          isSelected: false,
        }),
      ).not.toThrow();
    });

    it('lanza InvalidStrategyWeightsError si factorEscala = 0', () => {
      expect(() =>
        ValuationStrategy.create({
          id: 'id-6',
          userId: 'user-1',
          name: 'Zero factor',
          weights: VALID_WEIGHTS,
          factorEscala: 0,
          isSelected: false,
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });

    it('lanza InvalidStrategyWeightsError si factorEscala < 0', () => {
      expect(() =>
        ValuationStrategy.create({
          id: 'id-7',
          userId: 'user-1',
          name: 'Negative factor',
          weights: VALID_WEIGHTS,
          factorEscala: -5,
          isSelected: false,
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });

    it('lanza InvalidStrategyWeightsError si una clave no está en NORMALIZATION_BOUNDS', () => {
      const badWeights = { unknownMetric: 0.5, goals: 0.5 };

      expect(() =>
        ValuationStrategy.create({
          id: 'id-8',
          userId: 'user-1',
          name: 'Bad keys',
          weights: badWeights,
          factorEscala: 99,
          isSelected: false,
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });
  });

  describe('create() con positionWeights (014-position-weight-profiles)', () => {
    it('acepta un perfil de posición cuyo subconjunto de métricas suma 1.0', () => {
      const strategy = ValuationStrategy.create({
        id: 'id-9',
        userId: 'user-1',
        name: 'Con perfil',
        weights: VALID_WEIGHTS,
        factorEscala: 99,
        isSelected: true,
        positionWeights: {
          FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 },
        },
      });

      expect(strategy.positionWeights.FW).toEqual({
        goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15,
      });
    });

    it('acepta positionWeights ausente (estrategia sin ningún perfil)', () => {
      const strategy = ValuationStrategy.create({
        id: 'id-10',
        userId: 'user-1',
        name: 'Sin perfil',
        weights: VALID_WEIGHTS,
        factorEscala: 99,
        isSelected: true,
      });

      expect(strategy.positionWeights).toEqual({});
    });

    it('acepta pesos negativos en un perfil si la suma algebraica es 1.0', () => {
      expect(() =>
        ValuationStrategy.create({
          id: 'id-11',
          userId: 'user-1',
          name: 'Perfil con negativos',
          weights: VALID_WEIGHTS,
          factorEscala: 99,
          isSelected: true,
          positionWeights: {
            FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.20, yellowCards: -0.05 },
          },
        }),
      ).not.toThrow();
    });

    it('lanza InvalidStrategyWeightsError si un perfil no suma 1.0 (±0.001)', () => {
      expect(() =>
        ValuationStrategy.create({
          id: 'id-12',
          userId: 'user-1',
          name: 'Perfil inválido',
          weights: VALID_WEIGHTS,
          factorEscala: 99,
          isSelected: true,
          positionWeights: {
            FW: { goals: 0.5, shots: 0.3 }, // suma 0.8
          },
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });

    it('lanza InvalidStrategyWeightsError si un perfil referencia una métrica inválida', () => {
      expect(() =>
        ValuationStrategy.create({
          id: 'id-13',
          userId: 'user-1',
          name: 'Perfil con métrica inválida',
          weights: VALID_WEIGHTS,
          factorEscala: 99,
          isSelected: true,
          positionWeights: {
            GK: { saves: 1.0 },
          },
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });

    it('valida cada perfil de forma independiente (uno inválido entre varios válidos)', () => {
      expect(() =>
        ValuationStrategy.create({
          id: 'id-14',
          userId: 'user-1',
          name: 'Mix',
          weights: VALID_WEIGHTS,
          factorEscala: 99,
          isSelected: true,
          positionWeights: {
            FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 },
            MF: { assists: 0.9 }, // suma 0.9, fuera de tolerancia
          },
        }),
      ).toThrow(InvalidStrategyWeightsError);
    });
  });

  describe('restore()', () => {
    it('crea una instancia sin validar (para rehidratación desde persistencia)', () => {
      // Pesos inválidos no lanzan error en restore()
      const strategy = ValuationStrategy.restore({
        id: 'id-restore',
        userId: 'user-1',
        name: 'Restored',
        weights: { goals: 999 },
        factorEscala: 99,
        isSelected: true,
      });

      expect(strategy.id).toBe('id-restore');
    });
  });

  describe('weights getter', () => {
    it('retorna una copia superficial para no exponer el estado interno', () => {
      const strategy = ValuationStrategy.restore({
        id: 'id-immutable',
        userId: 'user-1',
        name: 'Test',
        weights: { goals: 1.0 },
        factorEscala: 99,
        isSelected: true,
      });

      const weights = strategy.weights;
      weights['goals'] = 0; // muta la copia

      expect(strategy.weights['goals']).toBe(1.0); // original intacto
    });
  });
});
