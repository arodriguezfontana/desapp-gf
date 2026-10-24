import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Holding } from '../types/portfolio';

interface PortfolioDistributionChartProps {
  holdings: Holding[];
}

const COLORS = ['#2dd4bf', '#b79753', '#a78bfa', '#f59e0b', '#fb7185', '#34d399', '#60a5fa', '#f472b6'];

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

const fmtShort = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export const PortfolioDistributionChart: React.FC<PortfolioDistributionChartProps> = ({ holdings }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (holdings.length === 0) return null;

  const data = holdings
    .map((h, i) => ({
      holding: h,
      name: h.playerName,
      value: h.tokenQuantity * h.currentPrice,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const maxValue = data[0].value;
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div
      role="img"
      aria-label="Distribución del valor del portfolio por jugador"
      className="space-y-2"
    >
      {data.map((row, i) => {
        const pct = (row.value / maxValue) * 100;
        const share = total > 0 ? ((row.value / total) * 100).toFixed(0) : '0';
        const h = row.holding;
        const plPositive = h.totalProfitLoss > 0;
        const plNegative = h.totalProfitLoss < 0;
        const plColor = plPositive ? 'text-[#6ab547]' : plNegative ? 'text-rose-400' : 'text-gray-300';
        const plSign = plPositive ? '+' : '';
        const isHovered = hoveredIndex === i;

        return (
          <div
            key={row.name}
            className="relative space-y-0.5 cursor-default"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-black uppercase tracking-wider truncate max-w-[70%]" style={{ color: row.color }}>
                {row.name}
              </span>
              <span className="font-bold text-gray-400 shrink-0">{share}% · {fmtShort(row.value)}</span>
            </div>
            <div className="h-3 bg-[#0c2221] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-150"
                style={{ width: `${pct}%`, backgroundColor: row.color, opacity: isHovered ? 1 : 0.65 }}
              />
            </div>

            {/* Tooltip */}
            {isHovered && (
              <div className="absolute left-0 top-full mt-1 z-10 bg-[#0b3332] border border-[#1a6866] rounded-xl p-3 shadow-xl text-[10px] w-64">
                <Link
                to={`/catalog/${h.playerId}`}
                className="font-black uppercase tracking-wider mb-2 block hover:underline"
                style={{ color: row.color }}
              >
                {row.name} →
              </Link>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400 uppercase tracking-wider font-bold">Tokens</span>
                    <span className="text-white font-bold">{h.tokenQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 uppercase tracking-wider font-bold">Precio Promedio</span>
                    <span className="text-white font-bold">{fmtCurrency(h.averageBuyPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 uppercase tracking-wider font-bold">Cotización Actual</span>
                    <span className="text-[#2dd4bf] font-bold">{fmtCurrency(h.currentPrice)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#1a6866] pt-1 mt-1">
                    <span className="text-gray-400 uppercase tracking-wider font-bold">Ganancia / Pérdida</span>
                    <span className={`font-black ${plColor}`}>{plSign}{fmtCurrency(h.totalProfitLoss)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
