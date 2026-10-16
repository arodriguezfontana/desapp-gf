/**
 * Capa de abstracción sobre localStorage para la ApiKey del catálogo.
 * Es la única fuente de verdad para la ApiKey.
 *
 * Emite 'apiKeySaved' / 'apiKeyCleared' en window para que todas las
 * instancias de useApiKey (en distintos componentes montados) reaccionen
 * sin necesidad de contexto global.
 */

const API_KEY_STORAGE_KEY = 'api_key';

export const apiKeyStorage = {
  getApiKey(): string | null {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  setApiKey(key: string): void {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      window.dispatchEvent(new Event('apiKeySaved'));
    } catch {
      // localStorage bloqueado (modo privado, etc.)
    }
  },

  clearApiKey(): void {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      window.dispatchEvent(new Event('apiKeyCleared'));
    } catch {
      // localStorage bloqueado
    }
  },
};

