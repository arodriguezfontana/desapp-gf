import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AppLayout() {
  const { isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b3332] text-white flex flex-col selection:bg-[#d4af37] selection:text-[#0b3332] pb-16 md:pb-0">
      {/* Top Warm Soft Gold Accent Strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#d4af37] shadow-md z-50" />

      {/* Main Navigation Header */}
      <header className="bg-[#0b3332]/95 backdrop-blur-md border-b border-[#1a6866] text-white sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Brand Logo: Circular Soft Gold Emblem */}
          <Link to="/catalog" className="flex items-center gap-3.5 group">
            <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#104443] to-[#0e3b3a] border-2 border-[#d4af37] flex items-center justify-center shadow-lg group-hover:scale-105 transition-all">
              <svg className="w-6 h-6 text-[#d4af37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 20h16" strokeLinecap="round" />
                <path d="M6 16v4" strokeLinecap="round" />
                <path d="M10 11v9" strokeLinecap="round" />
                <path d="M14 7v13" strokeLinecap="round" />
                <path d="M18 4v16" strokeLinecap="round" />
              </svg>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#d4af37] text-[#0b3332] rounded-full border border-[#0b3332] flex items-center justify-center text-[9px] font-black">
                ⚽
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white leading-none group-hover:text-[#d4af37] transition-colors">
                DESAPP <span className="text-[#d4af37]">FÚTBOL</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#2dd4bf] mt-1">
                Mercado Oficial de Fichajes
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-3 lg:gap-5">
            <NavLink
              to="/catalog"
              className={({ isActive }) =>
                `px-4 py-2 text-xs lg:text-sm font-extrabold uppercase tracking-widest transition-all rounded-xl ${
                  isActive
                    ? 'text-[#0b3332] bg-[#d4af37] shadow-md shadow-[#d4af37]/30'
                    : 'text-gray-200 hover:text-[#d4af37] hover:bg-[#104443]'
                }`
              }
            >
              Catálogo
            </NavLink>

            <NavLink
              to="/home"
              className={({ isActive }) =>
                `px-4 py-2 text-xs lg:text-sm font-extrabold uppercase tracking-widest transition-all rounded-xl ${
                  isActive
                    ? 'text-[#0b3332] bg-[#d4af37] shadow-md shadow-[#d4af37]/30'
                    : 'text-gray-200 hover:text-[#d4af37] hover:bg-[#104443]'
                }`
              }
            >
              Inicio
            </NavLink>

            {isAuthenticated ? (
              <div className="flex items-center gap-3 ml-2 pl-4 border-l border-[#1a6866]">
                <NavLink
                  to="/account"
                  className={({ isActive }) =>
                    `px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#104443] text-white border-[#d4af37]'
                        : 'text-gray-300 border-[#1a6866] hover:text-white hover:border-gray-400'
                    }`
                  }
                >
                  Mi cuenta
                </NavLink>

                <button
                  onClick={logout}
                  className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-[#f43f5e] hover:bg-[#e11d48] rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-[#0b3332] bg-[#d4af37] hover:bg-[#b89528] rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Iniciar Sesión
              </Link>
            )}
          </nav>

          {/* Mobile Hamburger Menu Toggle Button */}
          <div className="flex items-center md:hidden gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir menú de navegación"
              className="p-2 text-[#d4af37] hover:text-white focus:outline-none bg-[#104443] rounded-xl border border-[#1a6866]"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#0e3b3a] border-b border-[#1a6866] p-4 space-y-3 animate-fade-in">
            <NavLink
              to="/catalog"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#104443] rounded-xl"
            >
              Catálogo de Jugadores
            </NavLink>
            <NavLink
              to="/home"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#104443] rounded-xl"
            >
              Inicio Plataforma
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/account"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#104443] rounded-xl"
                >
                  Mi cuenta
                </NavLink>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#f43f5e] rounded-xl"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#0b3332] bg-[#d4af37] rounded-xl"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        )}

        {/* Subheader Ticker Banner */}
        <div className="bg-[#072221] border-t border-b border-[#1a6866] py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm">
            <h2 className="font-black uppercase tracking-widest text-[#d4af37] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] animate-pulse"></span>
              VALORACIÓN DE MERCADO: FÚTBOL EUROPEO
            </h2>
            <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold text-gray-300">
              <span>PREMIER LEAGUE <span className="text-[#2dd4bf]">● DISPONIBLE</span></span>
              <span>LA LIGA <span className="text-[#2dd4bf]">● DISPONIBLE</span></span>
              <span>SERIE A <span className="text-[#2dd4bf]">● DISPONIBLE</span></span>
              <span>BUNDESLIGA <span className="text-[#2dd4bf]">● DISPONIBLE</span></span>
              <span>LIGUE 1 <span className="text-[#2dd4bf]">● DISPONIBLE</span></span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (Fixed for Mobile Screens) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#072221] border-t-2 border-[#d4af37] z-50 flex items-center justify-around py-2 px-2 shadow-2xl">
        <NavLink
          to="/catalog"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
              isActive ? 'text-[#d4af37]' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <span className="text-base">📋</span>
          <span>Catálogo</span>
        </NavLink>

        <NavLink
          to="/home"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
              isActive ? 'text-[#d4af37]' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <span className="text-base">⚽</span>
          <span>Inicio</span>
        </NavLink>

        {isAuthenticated ? (
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                isActive ? 'text-[#d4af37]' : 'text-gray-400 hover:text-white'
              }`
            }
          >
            <span className="text-base">🔑</span>
            <span>Mi Cuenta</span>
          </NavLink>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#d4af37]"
          >
            <span className="text-base">🔒</span>
            <span>Ingresar</span>
          </Link>
        )}
      </nav>

      {/* Clean Minimalist Footer */}
      <footer className="bg-[#072221] border-t-2 border-[#d4af37]/40 text-gray-300 mt-auto pt-10 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Column 1: Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#104443] border border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-md">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 20h16M6 16v4M10 11v9M14 7v13M18 4v16" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-lg font-black uppercase tracking-wider text-white">
                  DESAPP <span className="text-[#d4af37]">FÚTBOL</span>
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                Plataforma oficial de fichajes, valoración y consulta de datos de las 5 principales ligas europeas.
              </p>
            </div>

            {/* Column 2: Navigation */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#d4af37] mb-3">
                SECCIONES
              </h3>
              <ul className="space-y-2 text-xs font-medium text-gray-300">
                <li><Link to="/catalog" className="hover:text-[#d4af37] transition-colors">Catálogo de Jugadores</Link></li>
                <li><Link to="/home" className="hover:text-[#d4af37] transition-colors">Inicio Plataforma</Link></li>
                <li><Link to="/account" className="hover:text-[#d4af37] transition-colors">Mi Cuenta</Link></li>
              </ul>
            </div>

            {/* Column 3: Competencias */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#d4af37] mb-3">
                COMPETENCIAS
              </h3>
              <p className="text-xs text-gray-300 font-medium leading-relaxed">
                Premier League • La Liga • Serie A • Bundesliga • Ligue 1
              </p>
            </div>
          </div>

          <div className="border-t border-[#1a6866] pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400 gap-3">
            <p>© 2026 Football Market. Todos los derechos reservados.</p>
            <div className="flex items-center gap-3">
              <span className="text-[#2dd4bf] font-bold">● SISTEMA ACTIVO</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
