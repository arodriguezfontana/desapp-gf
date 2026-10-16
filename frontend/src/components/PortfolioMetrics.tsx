import React from 'react';
import { Link } from 'react-router-dom';
import type { Holding } from '../types/portfolio';

interface Props {
  holdings: Holding[];
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export const PortfolioMetrics: React.FC<Props> = ({ holdings }) => {
  if (holdings.length === 0) return null;

  const best = holdings.reduce((a, b) => (b.totalProfitLoss > a.totalProfitLoss ? b : a));
  const worst = holdings.reduce((a, b) => (b.totalProfitLoss < a.totalProfitLoss ? b : a));
  const biggestPosition = holdings.reduce((a, b) =>
    b.currentPrice * b.tokenQuantity > a.currentPrice * a.tokenQuantity ? b : a,
  );
  const inGain = holdings.filter((h) => h.totalProfitLoss > 0).length;

  const bestSign = best.totalProfitLoss >= 0 ? '+' : '';
  const worstSign = worst.totalProfitLoss >= 0 ? '+' : '';

  return (
    <section aria-label="Métricas del portfolio" className="grid grid-cols-2 lg:grid-cols-4 gap-4">

      {/* Mejor rendimiento */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl flex flex-col gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#2dd4bf]">Mejor Rendimiento</span>
        <div>
          <p className="text-lg font-black text-white leading-tight truncate" title={best.playerName}>
            {best.playerName.split(' ')[0]}
          </p>
          <p className="text-sm font-black text-[#2dd4bf] tabular-nums mt-0.5">
            {bestSign}{fmt(best.totalProfitLoss)}
          </p>
        </div>
        <Link
          to={`/catalog/${best.playerId}`}
          className="text-[9px] font-black uppercase tracking-widest text-[#2dd4bf]/60 hover:text-[#2dd4bf] transition-colors self-start"
        >
          Ver ficha →
        </Link>
      </div>

      {/* Peor rendimiento */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl flex flex-col gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#f43f5e]">Peor Rendimiento</span>
        <div>
          <p className="text-lg font-black text-white leading-tight truncate" title={worst.playerName}>
            {worst.playerName.split(' ')[0]}
          </p>
          <p className="text-sm font-black text-[#f43f5e] tabular-nums mt-0.5">
            {worstSign}{fmt(worst.totalProfitLoss)}
          </p>
        </div>
        <Link
          to={`/catalog/${worst.playerId}`}
          className="text-[9px] font-black uppercase tracking-widest text-[#f43f5e]/60 hover:text-[#f43f5e] transition-colors self-start"
        >
          Ver ficha →
        </Link>
      </div>

      {/* Jugadores en ganancia */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl flex flex-col gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">En Ganancia</span>
        <div>
          <p className="text-3xl font-black text-white tabular-nums">
            {inGain}
            <span className="text-base text-gray-400 font-semibold"> / {holdings.length}</span>
          </p>
          <p className="text-xs text-gray-300 font-medium mt-0.5">jugadores en positivo</p>
        </div>
        <div className="h-1.5 rounded-full bg-[#0b3332] overflow-hidden mt-auto">
          <div
            className="h-full rounded-full bg-[#2dd4bf] transition-all"
            style={{ width: `${holdings.length > 0 ? (inGain / holdings.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Mayor posición */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl flex flex-col gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">Mayor Posición</span>
        <div>
          <p className="text-lg font-black text-white leading-tight truncate" title={biggestPosition.playerName}>
            {biggestPosition.playerName.split(' ')[0]}
          </p>
          <p className="text-sm font-black text-[#b79753] tabular-nums mt-0.5">
            {fmt(biggestPosition.currentPrice * biggestPosition.tokenQuantity)}
          </p>
        </div>
        <Link
          to={`/catalog/${biggestPosition.playerId}`}
          className="text-[9px] font-black uppercase tracking-widest text-[#b79753]/60 hover:text-[#b79753] transition-colors self-start"
        >
          Ver ficha →
        </Link>
      </div>

    </section>
  );
};
