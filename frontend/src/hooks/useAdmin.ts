import { useCallback } from 'react';
import { adminService } from '../service/adminService';
import type {
  SyncAcceptedDto,
  SyncRunStatusDto,
  SyncSummaryDto,
  RecalculateResponseDto,
  StrategyResponseDto,
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

  const recalculateQuotes = useCallback((): Promise<RecalculateResponseDto> => {
    return adminService.recalculateQuotes();
  }, []);

  const activateStrategy = useCallback(
    (strategyId: string): Promise<StrategyResponseDto> => {
      return adminService.activateStrategy(strategyId);
    },
    [],
  );

  return {
    triggerWhoScoredSync,
    getWhoScoredRunStatus,
    triggerFootballDataSync,
    recalculateQuotes,
    activateStrategy,
  };
}

