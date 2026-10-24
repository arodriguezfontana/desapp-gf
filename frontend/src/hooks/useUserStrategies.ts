import { useCallback } from 'react';
import { userStrategyService } from '../service/userStrategyService';
import type {
  UserStrategyListResponseDto,
  UserStrategyResponseDto,
} from '../types/userStrategy.types';

/**
 * Encapsula las llamadas de `service/userStrategyService` para que `pages/`
 * nunca importe `service/` directamente (constitución, Estructura).
 */
export function useUserStrategies() {
  const listStrategies = useCallback(
    (): Promise<UserStrategyListResponseDto> => userStrategyService.listStrategies(),
    [],
  );

  const selectStrategy = useCallback(
    (strategyId: string): Promise<UserStrategyResponseDto> =>
      userStrategyService.selectStrategy(strategyId),
    [],
  );

  const editWeights = useCallback(
    (strategyId: string, weights: Record<string, number>): Promise<UserStrategyResponseDto> =>
      userStrategyService.editWeights(strategyId, weights),
    [],
  );

  const editPositionWeights = useCallback(
    (
      strategyId: string,
      position: string,
      weights: Record<string, number>,
    ): Promise<UserStrategyResponseDto> =>
      userStrategyService.editPositionWeights(strategyId, position, weights),
    [],
  );

  return { listStrategies, selectStrategy, editWeights, editPositionWeights };
}
