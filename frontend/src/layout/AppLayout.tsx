import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent selection:text-white">
      {/* Top Multi-Color Strip (Boca Juniors style top bar) */}
      <div className="h-2 w-full bg-gradient-to-r from-accent via-secondary-bright to-accent shadow-sm" />

      {/* Solid Institutional Header */}
      <header className="bg-primary text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Brand Logo & Emblem */}
          <Link
            to="/home"
            className="flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 bg-accent flex items-center justify-center font-black text-white text-2xl rounded-xs shadow-md border-2 border-white/20 group-hover:scale-105 transition-transform">
              D
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black uppercase tracking-widest text-white leading-none group-hover:text-secondary-bright transition-colors">
                DESAPP <span className="text-accent">FÚTBOL</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mt-1">
                Plataforma Oficial
              </span>
            </div>
          </Link>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-3 sm:gap-6">
            <NavLink
              to="/home"
              className={({ isActive }) =>
                `px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xs border-b-2 ${
                  isActive
                    ? 'text-white bg-white/10 border-accent shadow-sm'
                    : 'text-white/80 border-transparent hover:text-white hover:bg-white/5'
                }`
              }
            >
              Inicio
            </NavLink>

            <NavLink
              to="/account"
              className={({ isActive }) =>
                `px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xs border-b-2 ${
                  isActive
                    ? 'text-white bg-white/10 border-accent shadow-sm'
                    : 'text-white/80 border-transparent hover:text-white hover:bg-white/5'
                }`
              }
            >
              Mi cuenta
            </NavLink>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="ml-2 px-5 py-2 text-xs font-black uppercase tracking-widest text-white bg-accent hover:bg-accent-hover transition-all rounded-xs shadow-md hover:shadow-lg active:scale-95 border border-white/20"
            >
              Cerrar Sesión
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      {/* Institutional Footer */}
      <footer className="bg-primary text-white border-t-4 border-accent mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-accent rounded-full animate-pulse" />
            <span className="font-black uppercase tracking-widest text-white text-sm">
              DESAPP FÚTBOL
            </span>
            <span className="text-emerald-300 font-bold uppercase">
              • SISTEMA ACTIVO
            </span>
          </div>
          <p className="text-white/70 font-medium">© 2026 Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
