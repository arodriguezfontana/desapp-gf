import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertsService } from './alertsService';
import { httpClient } from './httpClient';
import type { PriceAlertResponseDto } from '../types/alerts.types';

describe('alertsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('create llama a POST /alerts con el body indicado', async () => {
    const mockResponse: PriceAlertResponseDto = {
      id: 'alert-1',
      playerId: 'player-1',
      condition: 'PRICE_BELOW',
      targetValue: 10,
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00.000Z',
    };
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce(mockResponse);

    const result = await alertsService.create({ playerId: 'player-1', condition: 'PRICE_BELOW', targetValue: 10 });

    expect(postSpy).toHaveBeenCalledWith('/alerts', {
      playerId: 'player-1',
      condition: 'PRICE_BELOW',
      targetValue: 10,
    });
    expect(result).toEqual(mockResponse);
  });

  it('create propaga errores (p. ej. jugador inexistente, 404)', async () => {
    vi.spyOn(httpClient, 'post').mockRejectedValueOnce(new Error('No se encontró el jugador solicitado.'));

    await expect(
      alertsService.create({ playerId: 'nope', condition: 'PRICE_BELOW', targetValue: 10 }),
    ).rejects.toThrow('No se encontró el jugador solicitado.');
  });

  it('listOwn llama a GET /alerts y devuelve el array de alertas', async () => {
    const mockAlerts: PriceAlertResponseDto[] = [
      {
        id: 'alert-1',
        playerId: 'player-1',
        condition: 'PRICE_ABOVE',
        targetValue: 20,
        status: 'ACTIVE',
        createdAt: '2026-10-22T00:00:00.000Z',
      },
    ];
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockAlerts);

    const result = await alertsService.listOwn();

    expect(getSpy).toHaveBeenCalledWith('/alerts');
    expect(result).toEqual(mockAlerts);
  });

  it('cancel llama a DELETE /alerts/:id', async () => {
    const deleteSpy = vi.spyOn(httpClient, 'delete').mockResolvedValueOnce(undefined);

    await alertsService.cancel('alert-1');

    expect(deleteSpy).toHaveBeenCalledWith('/alerts/alert-1');
  });

  it('cancel propaga errores (p. ej. alerta ajena, 404)', async () => {
    vi.spyOn(httpClient, 'delete').mockRejectedValueOnce(new Error('No se encontró la alerta solicitada.'));

    await expect(alertsService.cancel('alert-1')).rejects.toThrow('No se encontró la alerta solicitada.');
  });
});
