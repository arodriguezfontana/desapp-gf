import { httpClient } from './httpClient';
import type { SyncAcceptedDto, SyncRunStatusDto, SyncSummaryDto } from '../types/admin.types';

/**
 * Operaciones del panel de administración.
 * Todas requieren ApiKey con rol admin (AdminApiKeyGuard en el backend).
 */
export const adminService = {
  /**
   * Dispara la sincronización asíncrona de WhoScored en background.
   */
  async triggerWhoScoredSync(): Promise<SyncAcceptedDto> {
    return httpClient.post<SyncAcceptedDto>('/sync/whoscored', undefined, {
      useApiKey: true,
    });
  },

  /**
   * Consulta el estado de una corrida de sincronización de WhoScored.
   */
  async getWhoScoredRunStatus(runId: string): Promise<SyncRunStatusDto> {
    return httpClient.get<SyncRunStatusDto>(`/sync/whoscored/${encodeURIComponent(runId)}`, {
      useApiKey: true,
    });
  },

  /**
   * Dispara la sincronización sincrónica de Football-Data (equipos, escudos, ligas).
   */
  async triggerFootballDataSync(): Promise<SyncSummaryDto> {
    return httpClient.post<SyncSummaryDto>('/sync/football-data', undefined, {
      useApiKey: true,
    });
  },

};
