import { describe, it, expect, vi } from 'vitest';
import { authService } from './authService';
import { httpClient } from './httpClient';

vi.mock('./httpClient', () => ({
  httpClient: { post: vi.fn() },
}));

describe('authService', () => {
  it('register llama a POST /auth/register con email y password', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce(undefined);

    await authService.register('nuevo@mail.com', 'Abcd1234!');

    expect(httpClient.post).toHaveBeenCalledWith('/auth/register', {
      email: 'nuevo@mail.com',
      password: 'Abcd1234!',
    });
  });

  it('login llama a POST /auth/login y devuelve el LoginResponseDto', async () => {
    const dto = { accessToken: 'jwt-xyz', tokenType: 'Bearer' as const, expiresIn: 86400 };
    vi.mocked(httpClient.post).mockResolvedValueOnce(dto);

    const result = await authService.login('user@mail.com', 'Abcd1234!');

    expect(httpClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@mail.com',
      password: 'Abcd1234!',
    });
    expect(result).toEqual(dto);
  });

  it('generateApiKey llama a POST /auth/api-key sin body y devuelve el IssueApiKeyResponseDto', async () => {
    const dto = { id: 'key-1', apiKey: 'pmk_abc', createdAt: '2026-09-16T12:00:00Z' };
    vi.mocked(httpClient.post).mockResolvedValueOnce(dto);

    const result = await authService.generateApiKey();

    expect(httpClient.post).toHaveBeenCalledWith('/auth/api-key', {});
    expect(result).toEqual(dto);
  });
});
