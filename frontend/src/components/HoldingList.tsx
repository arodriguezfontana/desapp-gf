import React from 'react';
import type { Holding } from '../types/portfolio';
import { PortfolioDistributionChart } from './PortfolioDistributionChart';

interface HoldingListProps {
  holdings: Holding[];
}

export const HoldingList: React.FC<HoldingListProps> = ({ holdings }) => {
  return (
    <section aria-label="Detalle de posiciones" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
          Mis Posiciones ({holdings.length})
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#104443] px-3 py-1 rounded-full border border-[#b79753]/30">
          HOLDINGS
        </span>
      </div>

      {holdings.length === 0 ? (
        <div className="text-center py-10 bg-[#104443] rounded-2xl border border-[#1a6866]">
          <p className="text-sm font-bold text-white mb-1">Aún no tenés posiciones en tu portfolio.</p>
          <p className="text-xs text-gray-400">Comprá tokens de jugadores para verlos acá.</p>
        </div>
      ) : (
        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">
            Distribución del Portfolio
          </h3>
          <PortfolioDistributionChart holdings={holdings} />
        </div>
      )}
    </section>
  );
};
