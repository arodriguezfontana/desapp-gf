import { useCallback } from 'react';
import { adminService } from '../service/adminService';
import type {
  RecalculateQuotesResultDto,
  SimulationResultDto,
  SyncAcceptedDto,
  SyncRunStatusDto,
  SyncSummaryDto,
} from '../types/admin.types';

/**
 * Hook para encapsular las llamadas de administración (`service/adminService`)
 * asegurando que `pages/` y `components/` nunca importen `service/` directamente
 * (Constitución, Principio I / Estructura).
 */
export function useAdmin() {
  const triggerWhoScoredSync = useCallback((): Promise<SyncAcceptedDto> => {
    return adminService.triggerWhoScoredSync();
  }, []);

  const getWhoScoredRunStatus = useCallback(
    (runId: string): Promise<SyncRunStatusDto> => {
      return adminService.getWhoScoredRunStatus(runId);
    },
    [],
  );

  const triggerFootballDataSync = useCallback((): Promise<SyncSummaryDto> => {
    return adminService.triggerFootballDataSync();
  }, []);

  const simulateMarket = useCallback((): Promise<SimulationResultDto> => {
    return adminService.simulateMarket();
  }, []);

  const recalculateQuotes = useCallback((): Promise<RecalculateQuotesResultDto> => {
    return adminService.recalculateQuotes();
  }, []);

  return {
    triggerWhoScoredSync,
    getWhoScoredRunStatus,
    triggerFootballDataSync,
    simulateMarket,
    recalculateQuotes,
  };
}
