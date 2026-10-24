import { httpClient } from './httpClient';
import type { CreatePriceAlertRequest, PriceAlertResponseDto } from '../types/alerts.types';

/**
 * Cliente de API para alertas de precio (025-player-price-alerts,
 * contracts/alerts-api.md). Única capa que conoce la base URL/headers/manejo
 * de errores de red para este recurso.
 */
export const alertsService = {
  async create(request: CreatePriceAlertRequest): Promise<PriceAlertResponseDto> {
    return httpClient.post<PriceAlertResponseDto>('/alerts', request);
  },

  async listOwn(): Promise<PriceAlertResponseDto[]> {
    return httpClient.get<PriceAlertResponseDto[]>('/alerts');
  },

  async cancel(alertId: string): Promise<void> {
    await httpClient.delete<void>(`/alerts/${alertId}`);
  },
};
