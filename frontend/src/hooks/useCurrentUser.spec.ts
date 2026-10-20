import { describe, it, expect, vi, afterEach } from 'vitest';
import { createContext } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useCurrentUser } from './useCurrentUser';
import { authService } from '../service/authService';
import type { MeResponseDto } from '../types/auth.types';

vi.mock('../contexts/auth-context', () => ({
  AuthContext: createContext(null),
}));

vi.mock('../service/authStorage', () => ({
  authStorage: {
    getToken: vi.fn(() => 'mock-token'),
  },
}));

describe('useCurrentUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser: MeResponseDto = {
    id: 'u1',
    email: 'test@test.com',
    username: 'tester',
    role: 'user',
  };

  it('obtiene el perfil del usuario autenticado y expone sus datos', async () => {
    vi.spyOn(authService, 'me').mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('isAdmin es true cuando el rol del usuario es admin', async () => {
    vi.spyOn(authService, 'me').mockResolvedValueOnce({ ...mockUser, role: 'admin' });

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAdmin).toBe(true);
  });

  it('captura el mensaje de error cuando authService.me falla', async () => {
    vi.spyOn(authService, 'me').mockRejectedValueOnce(new Error('Token expirado.'));

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe('Token expirado.');
  });

  it('usa mensaje genérico cuando el error no es una instancia de Error', async () => {
    vi.spyOn(authService, 'me').mockRejectedValueOnce('algo raro');

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Error al obtener perfil del usuario.');
  });

  it('expone refreshUser que vuelve a obtener el perfil', async () => {
    const meSpy = vi.spyOn(authService, 'me').mockResolvedValue(mockUser);

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.refreshUser();

    expect(meSpy).toHaveBeenCalledTimes(2);
    expect(result.current.user).toEqual(mockUser);
  });
});
