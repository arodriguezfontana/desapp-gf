import React from 'react';
import { Link } from 'react-router-dom';
import type { Holding } from '../types/portfolio';
import { PortfolioDistributionChart } from './PortfolioDistributionChart';

interface HoldingListProps {
  holdings: Holding[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

      <PortfolioDistributionChart holdings={holdings} />

      {/* Vista de Tabla para Pantallas Medianas y Grandes */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#1a6866] bg-[#104443] shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1a6866] bg-[#0e3b3a] text-[10px] font-black uppercase tracking-widest text-[#b79753]">
              <th scope="col" className="py-4 px-6">Jugador</th>
              <th scope="col" className="py-4 px-6 text-right">Tokens</th>
              <th scope="col" className="py-4 px-6 text-right">Precio Promedio</th>
              <th scope="col" className="py-4 px-6 text-right">Cotización Actual</th>
              <th scope="col" className="py-4 px-6 text-right">Ganancia / Pérdida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a6866]/60 text-xs sm:text-sm font-semibold">
            {holdings.map((holding) => {
              const isProfit = holding.totalProfitLoss > 0;
              const isLoss = holding.totalProfitLoss < 0;
              let plColor = 'text-gray-300';
              let plSign = '';

              if (isProfit) {
                plColor = 'text-[#6ab547]';
                plSign = '+';
              } else if (isLoss) {
                plColor = 'text-red-500';
              }

              return (
                <tr key={holding.playerId} className="hover:bg-[#165756]/50 transition-colors">
                  <td className="py-4 px-6 font-black uppercase text-white tracking-wide">
                    <Link to={`/catalog/${holding.playerId}`} className="hover:text-[#b79753] transition-colors">
                      {holding.playerName}
                    </Link>
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-gray-200">
                    {holding.tokenQuantity}
                  </td>
                  <td className="py-4 px-6 text-right text-gray-300">
                    {formatCurrency(holding.averageBuyPrice)}
                  </td>
                  <td className="py-4 px-6 text-right text-[#2dd4bf] font-bold">
                    {formatCurrency(holding.currentPrice)}
                  </td>
                  <td className={`py-4 px-6 text-right font-black ${plColor}`}>
                    {plSign}
                    {formatCurrency(holding.totalProfitLoss)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Vista de Tarjetas para Móviles */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {holdings.map((holding) => {
          const isProfit = holding.totalProfitLoss > 0;
          const isLoss = holding.totalProfitLoss < 0;
          let plColor = 'text-gray-300';
          let plSign = '';

          if (isProfit) {
            plColor = 'text-[#6ab547]';
            plSign = '+';
          } else if (isLoss) {
            plColor = 'text-red-500';
          }

          return (
            <div
              key={holding.playerId}
              className="bg-[#104443] border border-[#1a6866] rounded-xl p-5 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#1a6866] pb-2">
                <Link to={`/catalog/${holding.playerId}`} className="font-black uppercase text-white text-base hover:text-[#b79753] transition-colors">
                  {holding.playerName}
                </Link>
                <span className="text-xs font-black uppercase tracking-wider text-[#2dd4bf] bg-[#0b3332] px-2.5 py-1 rounded-md">
                  {holding.tokenQuantity} TOKENS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Precio Compra
                  </span>
                  <span className="text-gray-200 font-semibold">
                    {formatCurrency(holding.averageBuyPrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Cotización Actual
                  </span>
                  <span className="text-[#2dd4bf] font-semibold">
                    {formatCurrency(holding.currentPrice)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1a6866]/60">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">
                  Rendimiento
                </span>
                <span className={`font-black text-sm ${plColor}`}>
                  {plSign}
                  {formatCurrency(holding.totalProfitLoss)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

