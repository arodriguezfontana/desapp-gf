import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthActions } from './useAuthActions';
import * as authServiceModule from '../service/authService';

describe('useAuthActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('register delega en authService.register con email y password', async () => {
    const spy = vi
      .spyOn(authServiceModule.authService, 'register')
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuthActions());
    await result.current.register('user@mail.com', 'Pass1234!');

    expect(spy).toHaveBeenCalledWith('user@mail.com', 'Pass1234!');
  });

  it('login delega en authService.login y devuelve el LoginResponseDto', async () => {
    const spy = vi.spyOn(authServiceModule.authService, 'login').mockResolvedValueOnce({
      accessToken: 'jwt-abc',
      tokenType: 'Bearer',
      expiresIn: 86400,
    });

    const { result } = renderHook(() => useAuthActions());
    const res = await result.current.login('user@mail.com', 'Pass1234!');

    expect(spy).toHaveBeenCalledWith('user@mail.com', 'Pass1234!');
    expect(res.accessToken).toBe('jwt-abc');
  });

  it('generateApiKey delega en authService.generateApiKey y devuelve el DTO', async () => {
    const spy = vi.spyOn(authServiceModule.authService, 'generateApiKey').mockResolvedValueOnce({
      id: 'key-1',
      apiKey: 'pmk_abc',
      createdAt: '2026-09-16T12:00:00Z',
    });

    const { result } = renderHook(() => useAuthActions());
    const res = await result.current.generateApiKey();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(res.apiKey).toBe('pmk_abc');
  });
});
