import { useCallback, useEffect, useState } from 'react';
import { alertsService } from '../service/alertsService';
import type { AlertCondition, PriceAlertResponseDto } from '../types/alerts.types';

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Error inesperado al gestionar las alertas.';
}

/** Alertas propias del usuario autenticado (025-player-price-alerts). */
export function usePlayerAlerts() {
  const [alerts, setAlerts] = useState<PriceAlertResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await alertsService.listOwn();
      setAlerts(result);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createAlert = useCallback(
    async (playerId: string, condition: AlertCondition, targetValue: number) => {
      const created = await alertsService.create({ playerId, condition, targetValue });
      setAlerts((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const cancelAlert = useCallback(async (alertId: string) => {
    await alertsService.cancel(alertId);
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, status: 'CANCELLED' } : alert)),
    );
  }, []);

  return { alerts, isLoading, error, refetch, createAlert, cancelAlert };
}
