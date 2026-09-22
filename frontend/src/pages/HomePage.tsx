import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  {
    id: 1,
    image: '/assets/stadium_hero.jpg',
    badge: 'MERCADO OFICIAL DE FICHAJES',
    badgeColor: 'bg-[#d4af37] text-[#0b3332]',
    title: 'BIENVENIDO A DESAPP FÚTBOL',
    subtitle: 'Plataforma oficial de consulta de catálogo de jugadores y cotización en tiempo real para las 5 ligas europeas principales.',
    ctaText: 'EXPLORAR CATÁLOGO DE JUGADORES',
    ctaLink: '/catalog',
  },
  {
    id: 2,
    image: '/assets/soccer_player.jpg',
    badge: 'ACCESO PERSONAL & SEGURIDAD',
    badgeColor: 'bg-[#2dd4bf] text-[#0b3332]',
    title: 'GESTIÓN DE SEGURIDAD & APIKEY',
    subtitle: 'Administrá tus claves de acceso personales para consultar el catálogo de futbolistas con total seguridad y privacidad.',
    ctaText: 'IR A MI CUENTA & CLAVE',
    ctaLink: '/account',
  },
];

export function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  // Rotación automática de slides cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentSlide = HERO_SLIDES[activeSlide];

  return (
    <div className="w-full animate-fade-in">
      <title>Inicio — Football Market</title>

      {/* FULL WIDTH HERO SLIDER SECTION (EDGE-TO-EDGE) */}
      <section className="relative w-full bg-[#0b3332] border-b border-[#1a6866] min-h-[460px] sm:min-h-[500px] flex flex-col justify-between overflow-hidden group">
        {/* Background Slide Image with Full Bleed */}
        <div key={currentSlide.id} className="absolute inset-0 z-0 animate-hero-fade">
          <img
            src={currentSlide.image}
            alt="Estadio de fútbol profesional"
            className="w-full h-full object-cover filter brightness-50 contrast-110 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b3332] via-[#0b3332]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b3332]/95 via-[#0b3332]/60 to-transparent" />
        </div>

        {/* Content Container (Centered Content within Full Bleed Hero) */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
          {/* Top Floating Badge */}
          <div className="flex justify-between items-start mb-6">
            <span className={`px-4 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg ${currentSlide.badgeColor}`}>
              {currentSlide.badge}
            </span>

            <div className="flex items-center gap-2 bg-[#072221]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#d4af37]/30">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] animate-ping" />
              <span className="text-xs font-black uppercase tracking-widest text-white">
                TEMPORADA 2026 / 2027
              </span>
            </div>
          </div>

          {/* Hero Main Copy */}
          <div className="max-w-3xl my-4 sm:my-8">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider text-white leading-tight mb-4 drop-shadow-md">
              {currentSlide.title}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg font-medium text-gray-200 leading-relaxed mb-8 max-w-2xl drop-shadow">
              {currentSlide.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to={currentSlide.ctaLink}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#d4af37] hover:bg-[#b89528] text-[#0b3332] font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl hover:shadow-[#d4af37]/40 transition-all rounded-xl active:scale-95 border border-white/20"
              >
                <span>{currentSlide.ctaText}</span>
                <span className="text-lg">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Slide Indicators */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-6">
          <div className="flex items-center gap-3 max-w-xs">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setActiveSlide(index)}
                className="flex-1 py-2 group/btn focus:outline-none cursor-pointer"
                aria-label={`Ver slide ${index + 1}`}
              >
                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      index === activeSlide ? 'bg-[#d4af37] w-full' : 'bg-transparent w-0'
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CLEAN MINIMALIST FEATURE MODULES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] bg-[#104443] px-3.5 py-1.5 rounded-full border border-[#d4af37]/30 inline-block mb-3">
            FUNCIONALIDADES PRINCIPALES
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
            Explorá el Mercado de Fútbol
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 mt-2 font-medium">
            Accedé a información relevante, cotizaciones y datos de jugadores de las 5 grandes ligas de Europa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Module 1: Catálogo de Jugadores */}
          <div className="bg-[#104443] border border-[#1a6866] hover:border-[#d4af37] p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#0b3332] border border-[#d4af37]/40 text-[#d4af37] font-black text-xl flex items-center justify-center mb-6 shadow-inner">
                📋
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-[#2dd4bf] block mb-1">
                FUTBOLISTAS & CLUBES
              </span>
              <h3 className="text-xl font-black uppercase tracking-wider text-white mb-3 group-hover:text-[#d4af37] transition-colors">
                Catálogo de Jugadores
              </h3>
              <p className="text-xs font-medium text-gray-300 leading-relaxed mb-6">
                Consultá futbolistas de Premier League, La Liga, Serie A, Bundesliga y Ligue 1. Filtrá por posición, equipo o competencia con paginación integrada.
              </p>

              <ul className="space-y-2.5 text-xs font-bold text-gray-300 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-[#2dd4bf] font-black">✓</span>
                  <span>Filtros combinados por liga y club.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2dd4bf] font-black">✓</span>
                  <span>Búsqueda instantánea por nombre de equipo.</span>
                </li>
              </ul>
            </div>

            <Link
              to="/catalog"
              className="w-full py-3 bg-[#d4af37] hover:bg-[#b89528] text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center shadow-md hover:shadow-lg active:scale-95"
            >
              Ir al Catálogo &rarr;
            </Link>
          </div>

          {/* Module 2: Claves de Acceso Personal */}
          <div className="bg-[#104443] border border-[#1a6866] hover:border-[#d4af37] p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#0b3332] border border-[#d4af37]/40 text-[#d4af37] font-black text-xl flex items-center justify-center mb-6 shadow-inner">
                🔑
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] block mb-1">
                ACCESO SEGURO
              </span>
              <h3 className="text-xl font-black uppercase tracking-wider text-white mb-3 group-hover:text-[#d4af37] transition-colors">
                Gestión de Clave
              </h3>
              <p className="text-xs font-medium text-gray-300 leading-relaxed mb-6">
                Generá tu clave de acceso personal en tu panel de cuenta para ingresar de forma segura y consultar la información completa del catálogo.
              </p>

              <ul className="space-y-2.5 text-xs font-bold text-gray-300 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-[#d4af37] font-black">✓</span>
                  <span>Generación instantánea desde tu cuenta.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#d4af37] font-black">✓</span>
                  <span>Renovación segura de claves en 1 clic.</span>
                </li>
              </ul>
            </div>

            <Link
              to="/account"
              className="w-full py-3 bg-[#0e3b3a] hover:bg-[#165756] text-white font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center border border-[#d4af37]/40 shadow-md active:scale-95"
            >
              Mi Cuenta & Clave &rarr;
            </Link>
          </div>

          {/* Module 3: Fichas Técnicas & Valoración */}
          <div className="bg-[#104443] border border-[#1a6866] hover:border-[#d4af37] p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#0b3332] border border-[#d4af37]/40 text-[#d4af37] font-black text-xl flex items-center justify-center mb-6 shadow-inner">
                ⚽
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-[#2dd4bf] block mb-1">
                DETALLE TÉCNICO
              </span>
              <h3 className="text-xl font-black uppercase tracking-wider text-white mb-3 group-hover:text-[#d4af37] transition-colors">
                Fichas de Jugadores
              </h3>
              <p className="text-xs font-medium text-gray-300 leading-relaxed mb-6">
                Accedé al detalle individual de cada futbolista para consultar su demarcación, club de procedencia y liga de origen en un formato claro.
              </p>

              <ul className="space-y-2.5 text-xs font-bold text-gray-300 mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-[#2dd4bf] font-black">✓</span>
                  <span>Vistas individuales completas por jugador.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2dd4bf] font-black">✓</span>
                  <span>Navegación fluida y diseño responsivo.</span>
                </li>
              </ul>
            </div>

            <Link
              to="/catalog"
              className="w-full py-3 bg-[#0e3b3a] hover:bg-[#165756] text-[#d4af37] font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center border border-[#d4af37]/40 shadow-md active:scale-95"
            >
              Explorar Jugadores &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
