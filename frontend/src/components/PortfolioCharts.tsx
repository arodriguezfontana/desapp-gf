import React from 'react';
import type { Holding } from '../types/portfolio';

interface Props {
  holdings: Holding[];
}

const COLORS = [
  '#b79753', '#2dd4bf', '#60a5fa', '#f472b6',
  '#a78bfa', '#fb923c', '#4ade80', '#facc15',
];

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
) {
  const end = Math.min(endDeg, startDeg + 359.99);
  const p1 = polarToCartesian(cx, cy, outerR, startDeg);
  const p2 = polarToCartesian(cx, cy, outerR, end);
  const p3 = polarToCartesian(cx, cy, innerR, end);
  const p4 = polarToCartesian(cx, cy, innerR, startDeg);
  const large = end - startDeg > 180 ? 1 : 0;
  return `M${p1.x},${p1.y} A${outerR},${outerR} 0 ${large} 1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${innerR},${innerR} 0 ${large} 0 ${p4.x},${p4.y} Z`;
}

export const PortfolioCharts: React.FC<Props> = ({ holdings }) => {
  if (holdings.length === 0) return null;

  const items = holdings.slice(0, 8);

  // --- Donut: composición por valor actual ---
  const donutItems = items.map((h, i) => ({
    fullName: h.playerName,
    value: h.currentPrice * h.tokenQuantity,
    color: COLORS[i % COLORS.length],
  }));
  const totalValue = donutItems.reduce((s, d) => s + d.value, 0);

  const CX = 90, CY = 90, OUTER_R = 72, INNER_R = 44;
  const filteredDonut = donutItems.filter((d) => d.value > 0);
  const arcs = filteredDonut.reduce<Array<typeof filteredDonut[number] & { path: string }>>((acc, d, i) => {
    const start = acc.length === 0 ? 0 : acc[acc.length - 1].end;
    const sweep = i === filteredDonut.length - 1
      ? 360 - start
      : (d.value / totalValue) * 360;
    const end = start + sweep;
    return [...acc, { ...d, path: donutPath(CX, CY, OUTER_R, INNER_R, start, end), end }];
  }, []);

  // --- Barras: rentabilidad por jugador ---
  const BAR_H = 20;
  const BAR_GAP = 9;
  const NAME_W = 115;
  const BAR_MAX_W = 150;
  const SVG_W = NAME_W + BAR_MAX_W + 68;
  const SVG_H = items.length * (BAR_H + BAR_GAP) + 8;
  const maxAbs = Math.max(...items.map((h) => Math.abs(h.totalProfitLoss)), 0.01);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* ── Composición ── */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-4">
          Composición del Portfolio
        </h3>

        {totalValue === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            Sin datos de cotización disponibles.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <svg viewBox={`0 0 ${CX * 2} ${CY * 2}`} className="w-44 h-44 shrink-0">
              {arcs.map((arc) => (
                <path key={arc.fullName} d={arc.path} fill={arc.color} />
              ))}
              <text x={CX} y={CY - 5} textAnchor="middle" fontSize={9} fill="white" fontWeight="700" fontFamily="sans-serif">
                TOTAL
              </text>
              <text x={CX} y={CY + 9} textAnchor="middle" fontSize={10} fill="#b79753" fontWeight="800" fontFamily="sans-serif">
                ${totalValue.toFixed(0)}
              </text>
            </svg>

            <ul className="space-y-2 flex-1 min-w-0 w-full">
              {donutItems.map((d) => (
                <li key={d.fullName} className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-gray-300 font-medium truncate flex-1">{d.fullName}</span>
                  <span className="text-[10px] font-black shrink-0 tabular-nums" style={{ color: d.color }}>
                    {totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : '0.0'}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Rentabilidad ── */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-4">
          Rentabilidad por Jugador
        </h3>

        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
          {items.map((h, i) => {
            const name = h.playerName.length > 17 ? `${h.playerName.slice(0, 16)}…` : h.playerName;
            const isPos = h.totalProfitLoss >= 0;
            const barW = Math.max(3, (Math.abs(h.totalProfitLoss) / maxAbs) * BAR_MAX_W);
            const color = isPos ? '#2dd4bf' : '#f43f5e';
            const label = `${isPos ? '+' : ''}$${h.totalProfitLoss.toFixed(2)}`;
            const y = i * (BAR_H + BAR_GAP) + 4;
            return (
              <g key={h.playerId}>
                <text x={NAME_W - 6} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize={8.5} fill="#9ca3af" fontFamily="sans-serif">
                  {name}
                </text>
                <rect x={NAME_W} y={y} width={barW} height={BAR_H} rx={4} fill={color} opacity={0.8} />
                <text x={NAME_W + barW + 5} y={y + BAR_H / 2 + 4} fontSize={8.5} fill={color} fontWeight="700" fontFamily="sans-serif">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

    </div>
  );
};
