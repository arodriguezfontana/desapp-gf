import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authStorage } from '../service/authStorage';
import { httpEvents } from '../service/httpClient';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
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

  // Reaccionar a un 401 del backend sin importar en qué pantalla está el usuario
  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(false);
      navigate('/login', { replace: true });
    };
    httpEvents.addEventListener('unauthorized', handler);
    return () => httpEvents.removeEventListener('unauthorized', handler);
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
