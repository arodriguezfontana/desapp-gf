import { describe, it, expect, beforeEach } from 'vitest';
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
});

