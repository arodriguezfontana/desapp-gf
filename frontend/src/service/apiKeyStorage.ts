/**
 * Capa de abstracción sobre localStorage para la ApiKey del catálogo.
 * Es la única fuente de verdad para la ApiKey.
 */

const API_KEY_STORAGE_KEY = 'api_key';

export const apiKeyStorage = {
  getApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  },

  setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  },

  clearApiKey(): void {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  },
};

