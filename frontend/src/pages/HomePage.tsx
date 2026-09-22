import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  {
    id: 1,
    image: '/assets/stadium_hero.jpg',
    badge: 'KYLIAN MBAPPÉ: COTIZACIÓN SEMANAL +8%',
    badgeColor: 'bg-[#ff6b00] text-white',
    title: 'BIENVENIDO A DESAPP FÚTBOL',
    subtitle: 'MERCADO AL ALZA: LIGA SANTANDER — Sistema oficial de cotizaciones y valoración periódica de jugadores en tiempo real.',
    cta: 'ACTUALIZAR COTIZACIONES',
  },
  {
    id: 2,
    image: '/assets/soccer_player.jpg',
    badge: 'CREDENCIALES DE ACCESO & APIKEY',
    badgeColor: 'bg-[#10b981] text-[#071a12]',
    title: 'GESTIÓN DE SEGURIDAD & APIKEY',
    subtitle: 'Administrá tus claves de acceso personales para vincular aplicaciones y servicios autorizados con la máxima protección.',
    cta: 'VER MI CUENTA & APIKEY',
  },
];

// 3x3 Mock Players Grid data for Hero Section
const QUOTATION_CARDS = [
  { id: 1, name: 'Kylian Mbappé', team: 'Real Madrid', pos: 'FW', change: '+8%', positive: true, price: '180.000 CR' },
  { id: 2, name: 'Erling Haaland', team: 'Man. City', pos: 'FW', change: '+12%', positive: true, price: '175.000 CR' },
  { id: 3, name: 'Jude Bellingham', team: 'Real Madrid', pos: 'MF', change: '+5%', positive: true, price: '150.000 CR' },
  { id: 4, name: 'Vinícius Jr.', team: 'Real Madrid', pos: 'FW', change: '-4%', positive: false, price: '145.000 CR' },
  { id: 5, name: 'Lamine Yamal', team: 'FC Barcelona', pos: 'FW', change: '+15%', positive: true, price: '130.000 CR' },
  { id: 6, name: 'Lautaro Martínez', team: 'Inter Milan', pos: 'FW', change: '+6%', positive: true, price: '110.000 CR' },
  { id: 7, name: 'Harry Kane', team: 'Bayern München', pos: 'FW', change: '-2%', positive: false, price: '105.000 CR' },
  { id: 8, name: 'Rodri', team: 'Man. City', pos: 'MF', change: '+9%', positive: true, price: '125.000 CR' },
  { id: 9, name: 'Pedri', team: 'FC Barcelona', pos: 'MF', change: '-7%', positive: false, price: '95.000 CR' },
];

// Ranking Table Mock Data (5 Ligas Principales)
const PLAYER_RANKING = [
  { rank: 1, name: 'Kylian Mbappé', team: 'Real Madrid', league: 'La Liga', score: 98.4, val: '180.000 CR', change: '+8%' },
  { rank: 2, name: 'Erling Haaland', team: 'Manchester City', league: 'Premier League', score: 97.9, val: '175.000 CR', change: '+12%' },
  { rank: 3, name: 'Jude Bellingham', team: 'Real Madrid', league: 'La Liga', score: 96.5, val: '150.000 CR', change: '+5%' },
  { rank: 4, name: 'Vinícius Jr.', team: 'Real Madrid', league: 'La Liga', score: 95.8, val: '145.000 CR', change: '-4%' },
  { rank: 5, name: 'Lamine Yamal', team: 'FC Barcelona', league: 'La Liga', score: 94.7, val: '130.000 CR', change: '+15%' },
];

// Token Market Mock Data
const TOKEN_MARKET = [
  { id: 't1', name: 'TOKEN MBAPPÉ', symbol: 'FMT-KMB', price: '450 CR' },
  { id: 't2', name: 'TOKEN HAALAND', symbol: 'FMT-EHA', price: '420 CR' },
  { id: 't3', name: 'TOKEN YAMAL', symbol: 'FMT-LYA', price: '310 CR' },
];

export function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [quotations, setQuotations] = useState(QUOTATION_CARDS);
  const [isUpdating, setIsUpdating] = useState(false);

  // Rotación automática de slides cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleUpdateQuotations = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setQuotations((prev) =>
        prev.map((q) => {
          const randDelta = Math.floor(Math.random() * 5) - 2;
          const newPositive = randDelta >= 0;
          return {
            ...q,
            change: `${newPositive ? '+' : ''}${randDelta === 0 ? 3 : randDelta * 4}%`,
            positive: newPositive,
          };
        }),
      );
      setIsUpdating(false);
    }, 600);
  };

  const currentSlide = HERO_SLIDES[activeSlide];

  return (
    <div className="space-y-12 animate-fade-in">
      <title>Football Market — Valoración de Mercado & Fichajes</title>

      {/* SECTION 1: HERO SECTION (3x3 Grid on Left + Dynamic Banner Slider on Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: 3x3 Quotation Grid */}
        <div className="lg:col-span-7 bg-[#0d2b1e] border border-[#123828] rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00] bg-[#123828] px-2.5 py-1 rounded-md">
                COTIZACIONES EN VIVO
              </span>
              <h2 className="text-xl font-black uppercase tracking-wider text-white mt-1">
                Panel de Fichajes Europeo
              </h2>
            </div>
            <span className="text-xs font-bold text-[#10b981] bg-[#071a12] px-3 py-1 rounded-full border border-[#10b981]/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
              Mercado Abierto
            </span>
          </div>

          {/* 3x3 Grid of Player Cards */}
          <div className="grid grid-cols-3 gap-3.5">
            {quotations.map((p) => (
              <div
                key={p.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  p.positive
                    ? 'bg-[#071a12]/90 border-[#10b981]/40 hover:border-[#10b981]'
                    : 'bg-[#071a12]/90 border-[#ea580c]/40 hover:border-[#ea580c]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#123828] text-gray-300">
                      {p.pos}
                    </span>
                    <span
                      className={`text-xs font-extrabold px-1.5 py-0.5 rounded ${
                        p.positive
                          ? 'bg-[#10b981]/20 text-[#10b981]'
                          : 'bg-[#ea580c]/20 text-[#ea580c]'
                      }`}
                    >
                      {p.change}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white line-clamp-1">
                    {p.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {p.team}
                  </p>
                </div>

                <p className="text-xs font-black text-[#ff6b00] mt-2 pt-2 border-t border-[#123828]">
                  {p.price}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dynamic Animated Banner Slider */}
        <div className="lg:col-span-5 relative overflow-hidden rounded-2xl bg-[#0d2b1e] border-2 border-[#ff6b00]/40 shadow-2xl flex flex-col justify-between group">
          {/* Background Slide Image with Fade */}
          <div key={currentSlide.id} className="absolute inset-0 z-0 animate-hero-fade">
            <img
              src={currentSlide.image}
              alt="Jugadores de fútbol celebrando"
              className="w-full h-full object-cover filter brightness-70 contrast-110 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071a12] via-[#071a12]/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#071a12]/90 via-transparent to-[#071a12]/50" />
          </div>

          {/* Top Banner Badge */}
          <div className="relative z-10 p-6 flex justify-between items-start">
            <span className={`px-3.5 py-1.5 font-black text-xs uppercase tracking-widest rounded-lg shadow-lg ${currentSlide.badgeColor}`}>
              {currentSlide.badge}
            </span>
          </div>

          {/* Banner Text Content */}
          <div className="relative z-10 p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white mb-2 leading-tight drop-shadow">
              {currentSlide.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-200 font-medium mb-6 max-w-md drop-shadow">
              {currentSlide.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleUpdateQuotations}
                disabled={isUpdating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#ff6b00] hover:bg-[#e05e00] text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl hover:shadow-[#ff6b00]/50 transition-all cursor-pointer border border-white/20 active:scale-95 disabled:opacity-50"
              >
                <span>{isUpdating ? 'ACTUALIZANDO...' : 'ACTUALIZAR COTIZACIONES'}</span>
                <span className="text-base">↻</span>
              </button>

              <Link
                to="/account"
                className="inline-flex items-center justify-center px-4 py-3.5 bg-[#123828] hover:bg-[#10b981] text-white hover:text-[#071a12] font-black uppercase tracking-widest text-xs rounded-xl border border-[#ff6b00]/30 transition-all shadow-md"
              >
                Mi Cuenta
              </Link>
            </div>
          </div>

          {/* Slide Progress Indicators */}
          <div className="relative z-10 px-6 pb-6 flex items-center gap-2">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setActiveSlide(index)}
                className="flex-1 py-1.5 focus:outline-none cursor-pointer"
                aria-label={`Ver slide ${index + 1}`}
              >
                <div className="h-1.5 w-full bg-white/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      index === activeSlide ? 'bg-[#ff6b00] w-full' : 'bg-transparent w-0'
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: TABLES, TOKEN MARKET & PORTFOLIO */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Player Ranking Table */}
        <div className="lg:col-span-8 bg-[#0d2b1e] border border-[#123828] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00] bg-[#123828] px-2.5 py-1 rounded-md">
                TOP RANKING EUROPEO (5 LIGAS)
              </span>
              <h2 className="text-xl font-black uppercase tracking-wider text-white mt-1">
                Ranking de Jugadores
              </h2>
            </div>

            <Link
              to="/catalog"
              className="text-xs font-extrabold uppercase tracking-wider text-[#ff6b00] hover:text-[#ffedd5] transition-colors flex items-center gap-1"
            >
              <span>Ver catálogo completo</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* Detailed Financial Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#123828] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Jugador</th>
                  <th className="py-3 px-4">Equipo</th>
                  <th className="py-3 px-4">Liga</th>
                  <th className="py-3 px-3 text-center">Score</th>
                  <th className="py-3 px-4 text-right">Valor de Mercado (CR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#123828]/60">
                {PLAYER_RANKING.map((row) => (
                  <tr key={row.rank} className="hover:bg-[#123828]/40 transition-colors">
                    <td className="py-3.5 px-3 font-black text-[#ff6b00]">{row.rank}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{row.name}</td>
                    <td className="py-3.5 px-4 text-gray-300 font-medium">{row.team}</td>
                    <td className="py-3.5 px-4 text-gray-400 font-medium">{row.league}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="bg-[#123828] text-[#34d399] font-black px-2 py-0.5 rounded text-[11px]">
                        {row.score}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-white">
                      {row.val}{' '}
                      <span
                        className={`text-[10px] ml-1 font-bold ${
                          row.change.startsWith('+') ? 'text-[#10b981]' : 'text-[#ea580c]'
                        }`}
                      >
                        ({row.change})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (4 cols): Token Market & My Portfolio Panels */}
        <div className="lg:col-span-4 space-y-8">
          {/* Panel 1: Mercado de Tokens */}
          <div className="bg-[#0d2b1e] border border-[#123828] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b00]"></span>
                Mercado de Tokens
              </h3>
              <span className="text-[10px] font-bold text-[#10b981] uppercase bg-[#071a12] px-2 py-0.5 rounded border border-[#10b981]/30">
                En Vivo
              </span>
            </div>

            <div className="space-y-4">
              {TOKEN_MARKET.map((tok) => (
                <div
                  key={tok.id}
                  className="bg-[#071a12] p-4 rounded-xl border border-[#123828] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-white">{tok.name}</h4>
                      <span className="text-[10px] text-gray-400 font-bold">{tok.symbol}</span>
                    </div>
                    <span className="text-sm font-black text-[#ff6b00]">{tok.price}</span>
                  </div>

                  {/* Differentiated Action Buttons: COMPRAR (Naranja) y VENDER (Verde Claro) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      className="py-2 bg-[#ff6b00] hover:bg-[#e05e00] text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      COMPRAR
                    </button>
                    <button
                      type="button"
                      className="py-2 bg-[#10b981] hover:bg-[#059669] text-[#071a12] font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      VENDER
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: Mi Portfolio */}
          <div className="bg-[#0d2b1e] border-2 border-[#10b981]/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981] bg-[#071a12] px-2.5 py-1 rounded-md border border-[#10b981]/30">
                MI PORTFOLIO
              </span>
              <span className="text-xs font-extrabold text-[#10b981]">+14.2% Total</span>
            </div>

            <h3 className="text-2xl font-black text-white mb-1">
              45.280 <span className="text-sm font-bold text-[#ff6b00]">CR</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4 font-medium">
              Posición activa en tokens de jugadores
            </p>

            {/* Upward Trend SVG Chart Graphic */}
            <div className="h-20 w-full bg-[#071a12] rounded-xl p-2 border border-[#123828] mb-4 flex items-end">
              <svg className="w-full h-full text-[#10b981]" viewBox="0 0 100 40" fill="none">
                <path
                  d="M0 35 Q 20 30, 40 20 T 70 15 T 100 5"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                />
                <path
                  d="M0 35 Q 20 30, 40 20 T 70 15 T 100 5 L 100 40 L 0 40 Z"
                  fill="currentColor"
                  fillOpacity="0.15"
                />
              </svg>
            </div>

            <Link
              to="/account"
              className="w-full py-3 bg-[#123828] hover:bg-[#10b981] text-white hover:text-[#071a12] font-black uppercase text-xs tracking-widest transition-all rounded-xl text-center block shadow-md font-bold"
            >
              Gestionar mi Posición &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
