import React from 'react';
import type { PortfolioSummary as PortfolioSummaryType } from '../types/portfolio';

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ summary }) => {
  const { totalInvested, totalCurrentValue, netProfitLoss } = summary;

  const isPositive = netProfitLoss > 0;
  const isNegative = netProfitLoss < 0;

  let profitLossColor = 'text-gray-300';
  let badgeColor = 'bg-[#0b3332] text-gray-300 border-gray-600';
  let sign = '';

  if (isPositive) {
    profitLossColor = 'text-[#6ab547]';
    badgeColor = 'bg-[#6ab547]/10 text-[#6ab547] border-[#6ab547]/30';
    sign = '+';
  } else if (isNegative) {
    profitLossColor = 'text-red-500';
    badgeColor = 'bg-red-500/10 text-red-500 border-red-500/30';
  }

  const returnPercentage = totalInvested > 0 ? (netProfitLoss / totalInvested) * 100 : 0;

  return (
    <section aria-label="Resumen global del portfolio" className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Tarjeta 1: Total Invertido */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-[#b79753]">
          Capital Total Invertido
        </span>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            {formatCurrency(totalInvested)}
          </p>
          <span className="text-xs font-semibold text-gray-300 mt-1 block">
            Cálculo según precio promedio de compra
          </span>
        </div>
      </div>

      {/* Tarjeta 2: Valor Actual de Cartera */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-[#2dd4bf]">
          Valor Actual de Cartera
        </span>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            {formatCurrency(totalCurrentValue)}
          </p>
          <span className="text-xs font-semibold text-gray-300 mt-1 block">
            Basado en la última cotización calculada
          </span>
        </div>
      </div>

      {/* Tarjeta 3: Ganancia o Pérdida Neta */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#b79753]">
            Rendimiento Neto
          </span>
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}
          >
            {sign}
            {returnPercentage.toFixed(2)}%
          </span>
        </div>
        <div className="mt-3">
          <p className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${profitLossColor}`}>
            {sign}
            {formatCurrency(netProfitLoss)}
          </p>
          <span className="text-xs font-semibold text-gray-300 mt-1 block">
            Ganancia o pérdida neta acumulada
          </span>
        </div>
      </div>
    </section>
  );
};

