import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlayerAlerts } from './usePlayerAlerts';
import { alertsService } from '../service/alertsService';
import type { PriceAlertResponseDto } from '../types/alerts.types';

describe('usePlayerAlerts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockAlert: PriceAlertResponseDto = {
    id: 'alert-1',
    playerId: 'player-1',
    condition: 'PRICE_BELOW',
    targetValue: 10,
    status: 'ACTIVE',
    createdAt: '2026-10-22T00:00:00.000Z',
  };

  it('carga las alertas propias al montar', async () => {
    vi.spyOn(alertsService, 'listOwn').mockResolvedValueOnce([mockAlert]);

    const { result } = renderHook(() => usePlayerAlerts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.alerts).toEqual([mockAlert]);
  });

  it('createAlert antepone la alerta nueva a la lista', async () => {
    vi.spyOn(alertsService, 'listOwn').mockResolvedValueOnce([]);
    vi.spyOn(alertsService, 'create').mockResolvedValueOnce(mockAlert);

    const { result } = renderHook(() => usePlayerAlerts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createAlert('player-1', 'PRICE_BELOW', 10);
    });

    expect(result.current.alerts).toEqual([mockAlert]);
  });

  it('cancelAlert marca la alerta como CANCELLED sin volver a pedir el listado', async () => {
    vi.spyOn(alertsService, 'listOwn').mockResolvedValueOnce([mockAlert]);
    const cancelSpy = vi.spyOn(alertsService, 'cancel').mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePlayerAlerts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.cancelAlert('alert-1');
    });

    expect(cancelSpy).toHaveBeenCalledWith('alert-1');
    expect(result.current.alerts[0].status).toBe('CANCELLED');
  });

  it('expone un mensaje de error si listOwn falla', async () => {
    vi.spyOn(alertsService, 'listOwn').mockRejectedValueOnce(new Error('Error de red.'));

    const { result } = renderHook(() => usePlayerAlerts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Error de red.');
  });
});
