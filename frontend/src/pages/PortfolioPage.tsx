import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useUserOrders } from '../hooks/useUserOrders';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAdmin } from '../hooks/useAdmin';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { HoldingList } from '../components/HoldingList';
import { ActivityTabs } from '../components/ActivityTabs';
import { PortfolioMetrics } from '../components/PortfolioMetrics';
import { PortfolioEvolutionChart } from '../components/PortfolioEvolutionChart';
import { StrategiesPanel } from '../components/StrategiesPanel';

export const PortfolioPage: React.FC = () => {
  const { summary, holdings, isEmpty, isLoading, error, refetch: refetchPortfolio } = usePortfolio();
  const { transactions, isLoading: isHistoryLoading, error: historyError, refetch: refetchHistory } = useOrderHistory();
  const {
    orders,
    isLoading: isOrdersLoading,
    cancellingOrderId,
    error: ordersError,
    cancelOrder,
    refetch: refetchOrders,
  } = useUserOrders();
  const { isAdmin } = useCurrentUser();
  const { simulateMarket } = useAdmin();

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationMsg, setSimulationMsg] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const handleCancelOrder = async (orderId: string): Promise<boolean> => {
    const success = await cancelOrder(orderId);
    if (success) {
      void refetchPortfolio();
    }
    return success;
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationError(null);
    setSimulationMsg(null);
    try {
      const res = await simulateMarket();
      setSimulationMsg(res.message);
      await Promise.all([refetchPortfolio(), refetchOrders(), refetchHistory()]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSimulationError(err.message);
      } else {
        setSimulationError('No se pudo ejecutar la simulación de mercado.');
      }
    } finally {
      setIsSimulating(false);
    }
  };

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
          onClick={() => void refetchPortfolio()}
          className="inline-flex items-center gap-2 bg-[#0b3332] hover:bg-[#072221] text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl border border-white/20 transition-all cursor-pointer shadow-md"
        >
          Reintentar consulta
        </button>
      </div>
    );
  } else if (isEmpty) {
    content = (
      <div className="space-y-8">
        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-10 sm:p-14 text-center shadow-xl space-y-5">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753]/40 text-[#b79753] rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
            💼
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white mb-2">
              Aún no tienes tokens en tu portfolio
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 font-medium max-w-md mx-auto leading-relaxed">
              Explorá nuestro catálogo de jugadores para adquirir tokens o utilizá el botón de simulación rápida si eres
              administrador para poblar inmediatamente la plataforma.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-xl hover:shadow-[#b79753]/40 transition-all active:scale-95 cursor-pointer border border-white/20"
            >
              <span>Explorar Catálogo de Jugadores</span>
              <span className="text-base">&rarr;</span>
            </Link>

            {isAdmin && (
              <button
                type="button"
                onClick={handleSimulate}
                disabled={isSimulating}
                className="inline-flex items-center gap-2 bg-[#0e3b3a] hover:bg-[#165756] border-2 border-[#2dd4bf] text-[#2dd4bf] hover:text-white font-black uppercase tracking-widest text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <span>{isSimulating ? '⚙️ Simulando...' : '⚡ Simular Actividad de Mercado'}</span>
              </button>
            )}
          </div>
        </div>

        <ActivityTabs
          orders={orders}
          isOrdersLoading={isOrdersLoading}
          cancellingOrderId={cancellingOrderId}
          ordersError={ordersError}
          onCancelOrder={handleCancelOrder}
          transactions={transactions}
          isHistoryLoading={isHistoryLoading}
          historyError={historyError}
        />

        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl shadow-xl p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-white">Mis estrategias</h2>
          <StrategiesPanel />
        </div>
      </div>
    );
  } else {
    content = (
      <div className="space-y-8">
        <PortfolioSummary summary={summary} />
        <PortfolioMetrics holdings={holdings} />
        <PortfolioEvolutionChart transactions={transactions} />
        <HoldingList holdings={holdings} />
        <ActivityTabs
          orders={orders}
          isOrdersLoading={isOrdersLoading}
          cancellingOrderId={cancellingOrderId}
          ordersError={ordersError}
          onCancelOrder={handleCancelOrder}
          transactions={transactions}
          isHistoryLoading={isHistoryLoading}
          historyError={historyError}
        />

        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl shadow-xl p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-white">Mis estrategias</h2>
          <StrategiesPanel />
        </div>
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

            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  aria-label="Simular actividad de mercado"
                  className="inline-flex items-center gap-2 bg-[#0b3332]/95 hover:bg-[#165756] backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#2dd4bf]/50 text-[#2dd4bf] hover:text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <span>{isSimulating ? '⚙️ Simulando...' : '⚡ Simular Mercado'}</span>
                </button>
              )}

              {!isLoading && !error && !isEmpty && (
                <div className="flex items-center gap-3 bg-[#0b3332]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-[#b79753]/30 shadow-lg">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Snapshot de Cartera
                  </span>
                </div>
              )}
            </div>
          </div>

          {simulationError && (
            <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl font-bold">
              {simulationError}
            </div>
          )}

          {simulationMsg && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs p-3 rounded-xl font-bold">
              {simulationMsg}
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {content}
      </main>
    </div>
  );
};
