import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  {
    id: 1,
    image: '/assets/stadium_hero.jpg',
    badge: 'PLATAFORMA OFICIAL',
    badgeColor: 'bg-accent text-white',
    title: 'BIENVENIDO A DESAPP FÚTBOL',
    subtitle: 'Ingresaste correctamente a la plataforma oficial. Tu sesión se encuentra activa y resguardada para acceder a todos tus servicios.',
  },
  {
    id: 2,
    image: '/assets/soccer_player.jpg',
    badge: 'CREDENCIALES DE ACCESO',
    badgeColor: 'bg-secondary text-white',
    title: 'GESTIÓN DE SEGURIDAD & APIKEY',
    subtitle: 'Administrá tus claves de acceso personales para vincular aplicaciones y servicios autorizados con la máxima protección.',
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
    <div className="space-y-10 animate-fade-in">
      <title>Inicio — DesApp Fútbol</title>

      {/* DYNAMIC ANIMATED HERO SLIDER SECTION */}
      <div className="relative overflow-hidden rounded-xs bg-primary border-b-4 border-accent shadow-2xl min-h-[420px] flex flex-col justify-between group">
        {/* Background Slide Image with Fade Animation */}
        <div key={currentSlide.id} className="absolute inset-0 z-0 animate-hero-fade">
          <img
            src={currentSlide.image}
            alt="Estadio de fútbol profesional"
            className="w-full h-full object-cover filter brightness-65 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-transparent to-primary/40" />
        </div>

        {/* Floating Top Badge */}
        <div className="relative z-10 p-6 sm:p-8 flex justify-between items-start">
          <span className={`px-4 py-1.5 font-black text-xs uppercase tracking-widest rounded-xs shadow-lg ${currentSlide.badgeColor}`}>
            {currentSlide.badge}
          </span>

          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-black uppercase tracking-widest text-white">
              SESIÓN ACTIVA
            </span>
          </div>
        </div>

        {/* Hero Text Overlay */}
        <div className="relative z-10 p-6 sm:p-10 max-w-4xl">
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-widest text-white leading-tight mb-3 drop-shadow-lg">
            {currentSlide.title}
          </h1>
          <p className="text-sm sm:text-base font-medium text-white/90 leading-relaxed mb-6 max-w-2xl drop-shadow">
            {currentSlide.subtitle}
          </p>

          <Link
            to="/account"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest text-xs shadow-xl hover:shadow-accent/40 transition-all rounded-xs active:scale-95 border border-white/20"
          >
            <span>Ir a Mi Cuenta & Credenciales</span>
            <span className="text-lg">→</span>
          </Link>
        </div>

        {/* Animated Progress Indicators (Boca Slider Style) */}
        <div className="relative z-10 p-6 sm:px-10 pb-6 flex items-center gap-3">
          {HERO_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setActiveSlide(index)}
              className="flex-1 py-2 group/btn focus:outline-none"
              aria-label={`Ver slide ${index + 1}`}
            >
              <div className="h-1.5 w-full bg-white/30 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    index === activeSlide ? 'bg-accent w-full' : 'bg-transparent w-0'
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* VIVID CARDS SECTION (Boca Juniors Grid Cards - Clean Light Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Card 1: Bienvenido */}
        <div className="bg-white border-2 border-primary/20 hover:border-primary p-8 rounded-xs shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
          <div className="h-1.5 w-full bg-primary absolute top-0 left-0" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xs">
                ESTADO DE USUARIO
              </span>
              <span className="text-xs font-bold uppercase text-secondary-bright">VERIFICADO</span>
            </div>

            <h2 className="text-2xl font-black uppercase tracking-wider text-primary mb-3 group-hover:text-accent transition-colors">
              Tu Cuenta en DesApp Fútbol
            </h2>
            <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
              Te encontrás registrado e identificado en el sistema. Desde tu perfil tenés control total para gestionar la seguridad de tus accesos.
            </p>

            <ul className="space-y-3 text-xs font-bold text-slate-700 mb-6">
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 bg-secondary/15 text-secondary rounded-full flex items-center justify-center font-black">✓</span>
                <span>Sesión activa mantenida de forma segura.</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 bg-secondary/15 text-secondary rounded-full flex items-center justify-center font-black">✓</span>
                <span>Navegación resguardada en todas las secciones.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 2: Clave de Acceso (ApiKey) */}
        <div className="bg-white border-2 border-accent/30 hover:border-accent p-8 rounded-xs shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
          <div className="h-1.5 w-full bg-accent absolute top-0 left-0" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xs">
                CLAVE PERSONAL
              </span>
              <span className="text-xs font-bold uppercase text-accent">DISPONIBLE</span>
            </div>

            <h2 className="text-2xl font-black uppercase tracking-wider text-primary mb-3 group-hover:text-accent transition-colors">
              Gestión de Clave Personal
            </h2>
            <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
              Generá tu clave de acceso personal para operar de manera segura. Podés renovarla en cualquier momento desde tu panel de configuración.
            </p>

            <ul className="space-y-3 text-xs font-bold text-slate-700 mb-6">
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 bg-accent/15 text-accent rounded-full flex items-center justify-center font-black">✓</span>
                <span>Emisión instantánea con copia en un clic.</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 bg-accent/15 text-accent rounded-full flex items-center justify-center font-black">✓</span>
                <span>Reemplazo seguro con invalidación previa.</span>
              </li>
            </ul>
          </div>

          <Link
            to="/account"
            className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white font-black uppercase text-xs tracking-widest transition-all rounded-xs text-center shadow-md hover:shadow-lg active:scale-95"
          >
            Ir a Gestión de Mi Cuenta →
          </Link>
        </div>
      </div>
    </div>
  );
}
