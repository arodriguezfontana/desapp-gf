import { describe, it, expect, beforeEach } from 'vitest';
import { authStorage } from './authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getToken devuelve null si no hay token guardado', () => {
    expect(authStorage.getToken()).toBeNull();
  });

  it('setToken guarda el JWT en localStorage', () => {
    authStorage.setToken('fake-jwt-token');
    expect(authStorage.getToken()).toBe('fake-jwt-token');
    expect(localStorage.getItem('auth_token')).toBe('fake-jwt-token');
  });

  it('clearToken elimina el JWT de localStorage', () => {
    authStorage.setToken('fake-jwt-token');
    authStorage.clearToken();
    expect(authStorage.getToken()).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});

