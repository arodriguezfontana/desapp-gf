import { Injectable, Inject } from '@nestjs/common';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { ID_GENERATOR } from '../../modules/runtime/runtime.constants';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';

/**
 * Pesos seed de las dos estrategias que todo usuario recibe al alta
 * (019-per-user-valuation-strategies, spec FR-001, DD-001). Copiados
 * literalmente de los valores sembrados para la estrategia única de sistema
 * de 012-valuation-strategies / 014-position-weight-profiles
 * (data-model.md §Datos seed por usuario) — mismos nombres de campo del
 * dominio Player (`shots`, `passesCompleted`).
 */
const DEFAULT_STRATEGIES_SEED = [
  {
    name: 'Performance general',
    weights: {
      goals: 0.25,
      assists: 0.15,
      shots: 0.1,
      keyPasses: 0.1,
      dribbles: 0.1,
      totalTackles: 0.1,
      rating: 0.2,
    },
    positionWeights: {
      FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 },
      MF: { assists: 0.3, keyPasses: 0.3, dribbles: 0.15, rating: 0.25 },
      DF: { totalTackles: 0.4, interceptions: 0.25, rating: 0.25, passesCompleted: 0.1 },
      GK: { rating: 0.5, passesCompleted: 0.3, interceptions: 0.2 },
    },
    isSelected: true,
  },
  {
    name: 'Impacto táctico',
    weights: {
      totalTackles: 0.25,
      interceptions: 0.2,
      passesCompleted: 0.2,
      assists: 0.2,
      keyPasses: 0.15,
      rating: 0.2,
      yellowCards: -0.05,
      redCards: -0.15,
    },
    positionWeights: {
      FW: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.2, yellowCards: -0.05 },
      MF: { assists: 0.25, keyPasses: 0.25, passesCompleted: 0.2, rating: 0.2, totalTackles: 0.1 },
      DF: { totalTackles: 0.4, interceptions: 0.35, rating: 0.25 },
      GK: { rating: 0.5, passesCompleted: 0.35, interceptions: 0.15 },
    },
    isSelected: false,
  },
] as const;

const FACTOR_ESCALA = 99.0;

/**
 * Crea las dos estrategias propias de un usuario recién creado (alta normal
 * vía AuthService.register, o seed del admin vía AdminSeedService.run). Las
 * persiste como una unidad atómica: ambas se crean o ninguna
 * (plan.md, Constitution Check, Principio VI).
 */
@Injectable()
export class UserStrategyProvisioningService {
  constructor(
    private readonly strategyRepository: ValuationStrategyRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async provisionDefaultStrategiesFor(userId: string): Promise<ValuationStrategy[]> {
    const strategies = DEFAULT_STRATEGIES_SEED.map((seed) =>
      ValuationStrategy.create({
        id: this.ids.generate(),
        userId,
        name: seed.name,
        weights: { ...seed.weights },
        factorEscala: FACTOR_ESCALA,
        isSelected: seed.isSelected,
        positionWeights: seed.positionWeights,
      }),
    );

    return this.strategyRepository.saveMany(strategies);
  }
}
