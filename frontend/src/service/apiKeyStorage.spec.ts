import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiKeyStorage } from './apiKeyStorage';

describe('apiKeyStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('debe devolver null si no hay apiKey guardada', () => {
    expect(apiKeyStorage.getApiKey()).toBeNull();
  });

  it('debe guardar y obtener la apiKey correctamente', () => {
    apiKeyStorage.setApiKey('test-key-123');
    expect(apiKeyStorage.getApiKey()).toBe('test-key-123');
  });

  it('debe borrar la apiKey al llamar a clearApiKey', () => {
    apiKeyStorage.setApiKey('test-key-123');
    apiKeyStorage.clearApiKey();
    expect(apiKeyStorage.getApiKey()).toBeNull();
  });

  it('setApiKey emite el evento apiKeySaved en window', () => {
    const handler = vi.fn();
    window.addEventListener('apiKeySaved', handler);
    apiKeyStorage.setApiKey('pmk_abc');
    window.removeEventListener('apiKeySaved', handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('clearApiKey emite el evento apiKeyCleared en window', () => {
    const handler = vi.fn();
    window.addEventListener('apiKeyCleared', handler);
    apiKeyStorage.clearApiKey();
    window.removeEventListener('apiKeyCleared', handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

