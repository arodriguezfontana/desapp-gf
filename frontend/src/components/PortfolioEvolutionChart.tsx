import React, { useState } from 'react';
import type { TokenTransactionDto } from '../types/orders.types';

interface Props {
  transactions: TokenTransactionDto[];
}

const W = 600;
const H = 180;
const PX = 56; // espacio para etiquetas Y
const PY = 20;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

interface PlotPoint {
  x: number;
  y: number;
  value: number;
  tx: TokenTransactionDto;
}

interface TooltipState {
  pt: PlotPoint;
  svgX: number; // porcentaje horizontal (0–1) para posicionar el div
}

export const PortfolioEvolutionChart: React.FC<Props> = ({ transactions }) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-6 shadow-xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-4">
          Evolución del Capital Invertido
        </h3>
        <p className="text-xs text-gray-400 text-center py-8">
          Aún no hay operaciones registradas.
        </p>
      </div>
    );
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  let cumulative = 0;
  const series: { t: number; value: number; tx: TokenTransactionDto }[] = [];
  for (const tx of sorted) {
    const amount = Number(tx.price) * tx.quantity;
    cumulative += tx.type === 'CREDIT' ? amount : -amount;
    series.push({ t: new Date(tx.createdAt).getTime(), value: cumulative, tx });
  }

  const firstT = series[0].t - 1;
  const allPoints = [{ t: firstT, value: 0, tx: null as unknown as TokenTransactionDto }, ...series];

  const times = allPoints.map((p) => p.t);
  const values = allPoints.map((p) => p.value);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minV = Math.min(0, Math.min(...values));
  const maxV = Math.max(...values);
  const tRange = maxT - minT || 1;
  const vRange = maxV - minV || 1;

  const plotW = W - PX * 2;
  const plotH = H - PY * 2;

  const toX = (t: number) => PX + ((t - minT) / tRange) * plotW;
  const toY = (v: number) => PY + plotH - ((v - minV) / vRange) * plotH;

  const pts = allPoints.map((p) => ({ x: toX(p.t), y: toY(p.value), value: p.value, tx: p.tx }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const zeroY = toY(0);
  const showZeroLine = minV < 0;

  const areaPath = [
    `M${pts[0].x},${zeroY}`,
    ...pts.map((p) => `L${p.x},${p.y}`),
    `L${pts[pts.length - 1].x},${zeroY}`,
    'Z',
  ].join(' ');

  const yTicks = [minV, (minV + maxV) / 2, maxV];
  const visiblePts = pts.slice(1) as PlotPoint[];
  const lastPt = pts[pts.length - 1];
  const isPositive = lastPt.value >= 0;

  return (
    <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">
          Evolución del Capital Invertido
        </h3>
        <span
          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tabular-nums ${
            isPositive
              ? 'bg-[#2dd4bf]/10 text-[#2dd4bf] border-[#2dd4bf]/30'
              : 'bg-[#f43f5e]/10 text-[#f43f5e] border-[#f43f5e]/30'
          }`}
        >
          {isPositive ? '+' : ''}{formatCurrency(lastPt.value)} neto
        </span>
      </div>

      {/* Contenedor relativo para posicionar el tooltip */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Evolución del capital invertido"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid + etiquetas Y */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PX} y1={toY(v)} x2={W - PX} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={PX - 6} y={toY(v) + 4} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="sans-serif">
                {formatCurrency(v)}
              </text>
            </g>
          ))}

          {showZeroLine && (
            <line x1={PX} y1={zeroY} x2={W - PX} y2={zeroY} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 3" />
          )}

          <path d={areaPath} fill="url(#portfolioGrad)" />

          <polyline points={polyline} fill="none" stroke="#2dd4bf" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Línea vertical del tooltip */}
          {tooltip && (
            <line
              x1={tooltip.pt.x} y1={PY}
              x2={tooltip.pt.x} y2={PY + plotH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Puntos interactivos */}
          {visiblePts.map((p, i) => {
            const isHovered = tooltip?.pt === p;
            const dotColor = p.tx.type === 'CREDIT' ? '#a78bfa' : '#f59e0b';
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? '#fff' : dotColor}
                stroke={isHovered ? dotColor : '#104443'}
                strokeWidth={isHovered ? 2 : 1.5}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setTooltip({ pt: p, svgX: (p.x - PX) / plotW })}
              />
            );
          })}

          {/* Punto final siempre destacado */}
          {!tooltip && (
            <circle cx={lastPt.x} cy={lastPt.y} r={5} fill="#2dd4bf" stroke="#104443" strokeWidth={2} />
          )}
        </svg>

        {/* Tooltip flotante */}
        {tooltip && (() => {
          const { pt, svgX } = tooltip;
          const tx = pt.tx;
          const isCredit = tx.type === 'CREDIT';
          const amount = Number(tx.price) * tx.quantity;
          const sign = isCredit ? '+' : '-';
          const color = isCredit ? '#a78bfa' : '#f59e0b';
          // Posiciona a izquierda si el punto está en la mitad derecha
          const alignRight = svgX > 0.55;
          return (
            <div
              className="absolute bottom-full mb-2 z-10 pointer-events-none"
              style={{ left: alignRight ? undefined : `${svgX * 100}%`, right: alignRight ? `${(1 - svgX) * 100}%` : undefined }}
            >
              <div className="bg-[#0b3332] border border-[#1a6866] rounded-xl px-3 py-2.5 shadow-2xl text-left whitespace-nowrap">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  {formatDate(tx.createdAt)}
                </p>
                <p className="text-[11px] font-black text-white truncate max-w-[180px]">{tx.playerName}</p>
                <p className="text-[10px] font-semibold text-gray-300 mt-0.5">
                  {tx.quantity} token{tx.quantity !== 1 ? 's' : ''} · {formatCurrency(Number(tx.price))} c/u
                </p>
                <p className="text-[10px] font-black mt-1" style={{ color }}>
                  {isCredit ? 'COMPRA' : 'VENTA'} {sign}{formatCurrency(amount)}
                </p>
                <div className="border-t border-white/10 mt-1.5 pt-1.5">
                  <p className="text-[9px] text-gray-400 font-medium">
                    Capital neto acum.:{' '}
                    <span className="text-white font-black">{formatCurrency(pt.value)}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">{formatDate(sorted[0].createdAt)}</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: '#a78bfa' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#a78bfa' }} />{' '}
            Compra
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: '#f59e0b' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} />{' '}
            Venta
          </span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">{formatDate(sorted[sorted.length - 1].createdAt)}</span>
      </div>
    </div>
  );
};
