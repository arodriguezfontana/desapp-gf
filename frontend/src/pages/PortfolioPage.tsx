import React from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { HoldingList } from '../components/HoldingList';

export const PortfolioPage: React.FC = () => {
  const { summary, holdings, isEmpty, isLoading, error, refetch } = usePortfolio();

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="text-center py-20 bg-[#104443] rounded-2xl border border-[#1a6866] shadow-xl">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4" />
        <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">
          Cargando datos de tu portfolio...
        </p>
      </div>
    );
  } else if (error) {
    content = (
      <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-8 rounded-2xl text-center shadow-xl space-y-4">
        <div className="text-2xl">⚠️</div>
        <p className="text-sm font-bold uppercase tracking-wider">{error}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 bg-[#0b3332] hover:bg-[#072221] text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl border border-white/20 transition-all cursor-pointer shadow-md"
        >
          Reintentar consulta
        </button>
      </div>
    );
  } else if (isEmpty) {
    content = (
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-10 sm:p-14 text-center shadow-xl space-y-5">
        <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753]/40 text-[#b79753] rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
          💼
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white mb-2">
            Aún no tienes tokens en tu portfolio
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 font-medium max-w-md mx-auto leading-relaxed">
            Explorá nuestro catálogo de jugadores para descubrir talentos y adquirir tus primeros tokens de futbolistas.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-xl hover:shadow-[#b79753]/40 transition-all active:scale-95 cursor-pointer border border-white/20"
          >
            <span>Explorar Catálogo de Jugadores</span>
            <span className="text-base">&rarr;</span>
          </Link>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="space-y-8">
        <PortfolioSummary summary={summary} />
        <HoldingList holdings={holdings} />
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in space-y-8 pb-16">
      <title>Mi Portfolio — FútVal</title>

      {/* Header Banner */}
      <section className="relative w-full bg-[#0b3332] border-b border-[#1a6866] pt-8 pb-10 overflow-hidden group">
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/stadium_hero.jpg"
            alt="Estadio de fútbol"
            className="w-full h-full object-cover filter brightness-45 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b3332] via-[#0b3332]/85 to-[#0b3332]/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b3332]/95 via-[#0b3332]/70 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332]/90 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#b79753]/30 inline-block">
            INVERSIONES & ACTIVOS
          </span>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-wider text-white">
                Portfolio Personal
              </h1>
              <p className="text-gray-200 text-xs sm:text-sm mt-1 max-w-xl font-medium drop-shadow">
                Consultá el estado y rendimiento de tus tokens de futbolistas en base a las últimas cotizaciones oficiales.
              </p>
            </div>
            {!isLoading && !error && !isEmpty && (
              <div className="flex items-center gap-3 bg-[#0b3332]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-[#b79753]/30 shadow-lg self-start md:self-auto">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Snapshot de Cartera
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {content}
      </main>
    </div>
  );
};

