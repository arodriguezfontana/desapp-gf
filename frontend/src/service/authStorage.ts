/**
 * Capa de abstracción sobre localStorage para el JWT de sesión.
 * Es la única fuente de verdad del token; nadie más lee localStorage directamente.
 */

const AUTH_TOKEN_KEY = 'auth_token';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },
};

