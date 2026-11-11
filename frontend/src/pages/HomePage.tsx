import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  {
    id: 1,
    image: '/assets/stadium_hero.jpg',
    badge: 'MERCADO OFICIAL DE FICHAJES',
    badgeColor: 'bg-[#b79753] text-[#0b3332]',
    title: 'BIENVENIDO A FÚTVAL',
    subtitle: 'Comprá y vendé tokens de jugadores de las 5 ligas europeas principales, con cotizaciones calculadas según tu propia estrategia de valuación.',
    ctaText: 'EXPLORAR EL MERCADO',
    ctaLink: '/catalog',
    position: 'object-cover object-center',
  },
  {
    id: 2,
    image: '/assets/soccer_ball_macro.jpg',
    badge: 'ACCESO PERSONAL & SEGURIDAD',
    badgeColor: 'bg-[#2dd4bf] text-[#0b3332]',
    title: 'GESTIÓN DE SEGURIDAD & APIKEY',
    subtitle: 'Generá y renová tu clave de acceso personal para consultar el catálogo, y mantené tu cuenta protegida con total privacidad.',
    ctaText: 'IR A MI CUENTA & CLAVE',
    ctaLink: '/account',
    position: 'object-cover object-center',
  },
  {
    id: 3,
    image: '/assets/soccer_player.jpg',
    badge: 'PORTAFOLIO & OPERACIONES',
    badgeColor: 'bg-[#b79753] text-[#0b3332]',
    title: 'TU PORTAFOLIO EN UN SOLO LUGAR',
    subtitle: 'Seguí el valor de tus tokens, tus órdenes abiertas y el historial de tus operaciones en un solo lugar.',
    ctaText: 'VER MI PORTAFOLIO',
    ctaLink: '/portfolio',
    position: 'object-cover object-center',
  },
];

interface FeatureCard {
  id: string;
  image: string;
  imageAlt: string;
  imagePosition: string;
  tag: string;
  tagStyle: string;
  title: string;
  description: string;
  bullets: string[];
  bulletColor: string;
  ctaText: string;
  ctaLink: string;
  ctaStyle: string;
}

const CTA_PRIMARY =
  'w-full py-3 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center shadow-md hover:shadow-lg active:scale-95 mt-2';
const CTA_SECONDARY =
  'w-full py-3 bg-[#0e3b3a] hover:bg-[#165756] text-white font-black uppercase tracking-widest text-xs transition-all rounded-xl text-center border border-[#b79753]/40 shadow-md active:scale-95 mt-2';
const TAG_TEAL = 'text-[#2dd4bf] border-[#2dd4bf]/40';
const TAG_GOLD = 'text-[#b79753] border-[#b79753]/40';

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'catalogo',
    image: '/assets/home_catalog_players.jpg',
    imageAlt: 'Duelo y acción de jugadores de fútbol',
    imagePosition: 'object-[center_40%]',
    tag: 'CATÁLOGO & RANKING',
    tagStyle: TAG_TEAL,
    title: 'Catálogo y Ranking',
    description:
      'Consultá futbolistas de Premier League, La Liga, Serie A, Bundesliga y Ligue 1, y mirá quiénes lideran el ranking de cotización.',
    bullets: [
      'Filtros combinados por liga, posición y club.',
      'Ranking de jugadores según su valuación.',
    ],
    bulletColor: 'text-[#2dd4bf]',
    ctaText: 'Ir al Catálogo',
    ctaLink: '/catalog',
    ctaStyle: CTA_PRIMARY,
  },
  {
    id: 'mercado',
    image: '/assets/tactics_board.jpg',
    imageAlt: 'Pizarra táctica con jugadas de fútbol',
    imagePosition: 'object-center',
    tag: 'MERCADO DE ÓRDENES',
    tagStyle: TAG_GOLD,
    title: 'Comprá y Vendé Tokens',
    description:
      'Entrá al detalle de cualquier jugador para publicar órdenes de compra o venta y seguir su cotización en el tiempo.',
    bullets: [
      'Libro de órdenes con la profundidad del mercado.',
      'Historial de cotizaciones del jugador.',
    ],
    bulletColor: 'text-[#b79753]',
    ctaText: 'Operar en el Mercado',
    ctaLink: '/catalog',
    ctaStyle: CTA_PRIMARY,
  },
  {
    id: 'portafolio',
    image: '/assets/golden_trophy.jpg',
    imageAlt: 'Trofeo dorado',
    imagePosition: 'object-center',
    tag: 'MI PORTAFOLIO',
    tagStyle: TAG_GOLD,
    title: 'Mi Portafolio',
    description:
      'Mirá cuánto valen tus tokens, cuánto ganaste o perdiste y cómo evolucionó tu cartera, con tus propias estrategias de valuación.',
    bullets: [
      'Tenencias, ganancia o pérdida y evolución del valor.',
      'Mis órdenes abiertas e historial de operaciones.',
    ],
    bulletColor: 'text-[#b79753]',
    ctaText: 'Ver mi Portafolio',
    ctaLink: '/portfolio',
    ctaStyle: CTA_SECONDARY,
  },
];

export function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  // Rotación automática de los 3 slides cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentSlide = HERO_SLIDES[activeSlide];

  return (
    <div className="w-full animate-fade-in">
      <title>FútVal</title>

      {/* FULL WIDTH HERO SLIDER SECTION (3 SLIDES MAX) */}
      <section className="relative w-screen -ml-[calc((100vw-100%)/2)] bg-[#0b3332] border-b border-[#1a6866] min-h-[calc(100vh-160px)] flex flex-col justify-between overflow-hidden group">
        {/* Background Slide Image */}
        <div key={currentSlide.id} className="absolute inset-0 z-0 animate-hero-fade flex items-center justify-center bg-[#072221]">
          <img
            src={currentSlide.image}
            alt={currentSlide.title}
            className={`w-full h-full ${currentSlide.position} filter brightness-75 contrast-105 group-hover:scale-105 transition-transform duration-700`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b3332] via-[#0b3332]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b3332]/70 via-[#0b3332]/30 to-transparent" />
        </div>

        {/* Badge + Temporada — anclados al top de la sección */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 flex justify-between items-start">
          <span className={`px-4 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg ${currentSlide.badgeColor}`}>
            {currentSlide.badge}
          </span>

          <div className="flex items-center gap-2 bg-[#072221]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#b79753]/30">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] animate-ping" />
            <span className="text-xs font-black uppercase tracking-widest text-white">
              TEMPORADA 2026 / 2027
            </span>
          </div>
        </div>

        {/* Título, subtítulo y CTA — pegados al fondo */}
        <div className="relative z-10 flex-1 flex flex-col justify-end max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider text-white leading-tight mb-4 drop-shadow-md">
              {currentSlide.title}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg font-medium text-gray-200 leading-relaxed mb-8 max-w-2xl drop-shadow">
              {currentSlide.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to={currentSlide.ctaLink}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl hover:shadow-[#b79753]/40 transition-all rounded-xl active:scale-95 border border-white/20"
              >
                <span>{currentSlide.ctaText}</span>
                <span className="text-lg">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom 3 Slide Indicators */}
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
                      index === activeSlide ? 'bg-[#b79753] w-full' : 'bg-transparent w-0'
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED MODULES WITH DECORATIVE ASSET IMAGES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#104443] px-3.5 py-1.5 rounded-full border border-[#b79753]/30 inline-block mb-3">
            FUNCIONALIDADES PRINCIPALES
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
            Todo lo que podés hacer en FútVal
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 mt-2 font-medium">
            Consultá el catálogo, operá en el mercado y seguí tu portafolio con los jugadores de las 5 grandes ligas de Europa.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {FEATURE_CARDS.map((card) => (
            <div
              key={card.id}
              className="bg-[#104443] border border-[#1a6866] hover:border-[#b79753] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
            >
              <div className="relative h-52 sm:h-56 overflow-hidden border-b border-[#1a6866]">
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className={`w-full h-full object-cover ${card.imagePosition} filter brightness-90 group-hover:scale-105 transition-transform duration-500`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#104443] via-[#104443]/20 to-transparent" />
                <span
                  className={`absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest bg-[#0b3332]/90 backdrop-blur-md px-3 py-1 rounded-md border ${card.tagStyle}`}
                >
                  {card.tag}
                </span>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-wider text-white mb-3 group-hover:text-[#b79753] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs font-medium text-gray-300 leading-relaxed mb-6">{card.description}</p>

                  <ul className="space-y-2.5 text-xs font-bold text-gray-300 mb-6">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2">
                        <span className={`${card.bulletColor} font-black`}>✓</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link to={card.ctaLink} className={card.ctaStyle}>
                  {card.ctaText} &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
