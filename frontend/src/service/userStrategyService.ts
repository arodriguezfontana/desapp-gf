import { httpClient } from './httpClient';
import type {
  UserStrategyListResponseDto,
  UserStrategyResponseDto,
} from '../types/userStrategy.types';

/**
 * Estrategias de valuación propias del usuario autenticado
 * (019-per-user-valuation-strategies). Todas las llamadas usan el JWT de
 * sesión (sin `useApiKey`), a diferencia del resto del catálogo que usa
 * ApiKey. El recálculo de cotizaciones es una operación de sistema
 * (admin-only, `POST /quotes/recalculate`) y vive en `adminService`, no acá.
 */
export const userStrategyService = {
  async listStrategies(): Promise<UserStrategyListResponseDto> {
    return httpClient.get<UserStrategyListResponseDto>('/users/me/strategies');
  },

  async selectStrategy(strategyId: string): Promise<UserStrategyResponseDto> {
    return httpClient.patch<UserStrategyResponseDto>(
      `/users/me/strategies/${encodeURIComponent(strategyId)}/select`,
    );
  },

  async editWeights(
    strategyId: string,
    weights: Record<string, number>,
  ): Promise<UserStrategyResponseDto> {
    return httpClient.patch<UserStrategyResponseDto>(
      `/users/me/strategies/${encodeURIComponent(strategyId)}/weights`,
      { weights },
    );
  },

  async editPositionWeights(
    strategyId: string,
    position: string,
    weights: Record<string, number>,
  ): Promise<UserStrategyResponseDto> {
    return httpClient.patch<UserStrategyResponseDto>(
      `/users/me/strategies/${encodeURIComponent(strategyId)}/position-weights/${encodeURIComponent(position)}`,
      { weights },
    );
  },
};
