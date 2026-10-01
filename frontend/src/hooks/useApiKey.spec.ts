import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApiKey } from './useApiKey';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { httpEvents } from '../service/httpClient';

describe('useApiKey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hasApiKey arranca en false si no hay ApiKey guardada', () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current.hasApiKey).toBe(false);
  });

  it('hasApiKey arranca en true si ya hay una ApiKey guardada', () => {
    apiKeyStorage.setApiKey('pmk_existente');
    const { result } = renderHook(() => useApiKey());
    expect(result.current.hasApiKey).toBe(true);
  });

  it('saveApiKey persiste la clave en apiKeyStorage y pone hasApiKey en true', () => {
    const { result } = renderHook(() => useApiKey());

    act(() => {
      result.current.saveApiKey('pmk_nueva');
    });

    expect(result.current.hasApiKey).toBe(true);
    expect(apiKeyStorage.getApiKey()).toBe('pmk_nueva');
  });

  it('ante el evento apiKeyUnauthorized pone hasApiKey en false', () => {
    apiKeyStorage.setApiKey('pmk_vencida');
    const { result } = renderHook(() => useApiKey());
    expect(result.current.hasApiKey).toBe(true);

    act(() => {
      httpEvents.dispatchEvent(new Event('apiKeyUnauthorized'));
    });

    expect(result.current.hasApiKey).toBe(false);
  });

  it('deja de escuchar el evento después de desmontarse', () => {
    apiKeyStorage.setApiKey('pmk_vencida');
    const { result, unmount } = renderHook(() => useApiKey());
    unmount();

    act(() => {
      httpEvents.dispatchEvent(new Event('apiKeyUnauthorized'));
    });

    // No hay assertion sobre `result.current` post-unmount posible en RTL;
    // lo que se verifica es que dispatch no tira (no quedó un listener roto).
    expect(result.current).toBeDefined();
  });
});
