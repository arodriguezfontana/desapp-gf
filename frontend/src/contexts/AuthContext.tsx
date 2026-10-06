import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authStorage } from '../service/authStorage';
import { httpEvents } from '../service/httpClient';
import { AuthContext } from './auth-context';

interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => authStorage.getToken() !== null,
  );

  const logout = useCallback(() => {
    authStorage.clearToken();
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  const login = useCallback((token: string) => {
    authStorage.setToken(token);
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(false);
      navigate('/login', { replace: true });
    };
    httpEvents.addEventListener('unauthorized', handler);
    return () => httpEvents.removeEventListener('unauthorized', handler);
  }, [navigate]);

  const value = useMemo(
    () => ({ isAuthenticated, login, logout }),
    [isAuthenticated, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}