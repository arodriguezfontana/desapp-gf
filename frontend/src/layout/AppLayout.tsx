import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Layout de páginas protegidas.
 * Header deportivo con fondo primary, tipografía pesada en mayúsculas,
 * navegación a /home y /account, y botón de logout.
 */
export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-primary text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo / Nombre */}
          <Link
            to="/home"
            className="text-xl font-black uppercase tracking-widest hover:text-secondary transition-colors"
          >
            DesApp
          </Link>

          {/* Navegación */}
          <nav className="flex items-center gap-4">
            <Link
              to="/home"
              className="text-sm font-bold uppercase tracking-wide hover:text-secondary transition-colors"
            >
              Inicio
            </Link>
            <Link
              to="/account"
              className="text-sm font-bold uppercase tracking-wide hover:text-secondary transition-colors"
            >
              Mi cuenta
            </Link>
            <button
              onClick={logout}
              className="text-sm font-bold uppercase tracking-wide border border-white/60 px-3 py-1 hover:bg-white hover:text-primary transition-colors"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>

      {/* Contenido de página */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

