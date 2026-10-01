import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Envuelve rutas que sólo tienen sentido sin sesión activa (login, registro).
 * Si el usuario ya está autenticado, lo redirige lejos de esas pantallas
 * (003-frontend-auth FR-014 / Edge Case) al mismo destino que un login
 * exitoso: `/home`.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
