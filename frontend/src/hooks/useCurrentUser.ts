import { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../contexts/auth-context';
import { authStorage } from '../service/authStorage';
import { authService } from '../service/authService';
import type { MeResponseDto } from '../types/auth.types';

export function useCurrentUser() {
  const auth = useContext(AuthContext);
  const isAuthenticated = auth ? auth.isAuthenticated : authStorage.getToken() !== null;
  const [user, setUser] = useState<MeResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!isAuthenticated) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await authService.me();
      setUser(data);
    } catch (err: unknown) {
      setUser(null);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al obtener perfil del usuario.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve(isAuthenticated).then((authenticated) => {
      if (!authenticated) {
        if (!cancelled) { setUser(null); setIsLoading(false); }
        return;
      }
      if (!cancelled) { setIsLoading(true); setError(null); }
      authService
        .me()
        .then((data) => { if (!cancelled) setUser(data); })
        .catch((err: unknown) => {
          if (!cancelled) {
            setUser(null);
            setError(err instanceof Error ? err.message : 'Error al obtener perfil del usuario.');
          }
        })
        .finally(() => { if (!cancelled) setIsLoading(false); });
    });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return {
    user,
    isAdmin: user?.role === 'admin',
    isLoading,
    error,
    refreshUser: fetchUser,
  };
}
