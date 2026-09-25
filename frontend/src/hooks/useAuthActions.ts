import { useCallback } from 'react';
import { authService } from '../service/authService';
import type { IssueApiKeyResponseDto, LoginResponseDto } from '../types/auth.types';

/**
 * Encapsula las llamadas de red de autenticación (`service/authService`)
 * para que las páginas nunca importen `service/` directamente (constitución:
 * "hooks/ y contexts/ — únicas capas que MUST invocar service/").
 */
export function useAuthActions() {
  const register = useCallback(
    (email: string, password: string): Promise<void> =>
      authService.register(email, password),
    [],
  );

  const login = useCallback(
    (email: string, password: string): Promise<LoginResponseDto> =>
      authService.login(email, password),
    [],
  );

  const generateApiKey = useCallback(
    (): Promise<IssueApiKeyResponseDto> => authService.generateApiKey(),
    [],
  );

  return { register, login, generateApiKey };
}
