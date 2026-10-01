import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../contexts/auth-context';

/**
 * Hook de acceso al contexto de autenticación.
 * Lanza un error claro si se usa fuera del AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return ctx;
}
