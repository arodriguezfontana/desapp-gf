import React, { useState } from 'react';
import type { PlayerQuote } from '../types/catalog.types';

interface QuoteHistoryChartProps {
  quotes: PlayerQuote[];
  color?: string;
}

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 160;
const PADDING_X = 12;
const PADDING_Y = 16;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const toDateKey = (iso: string) => iso.slice(0, 10); // 'YYYY-MM-DD'

interface PlotPoint {
  x: number;
  y: number;
  quote: PlayerQuote;
}

export const QuoteHistoryChart: React.FC<QuoteHistoryChartProps> = ({ quotes, color = '#2dd4bf' }) => {
  const [hovered, setHovered] = useState<PlotPoint | null>(null);

  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 py-8 px-5 text-center" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <p className="text-xs font-bold text-white/40 uppercase tracking-wider">
          Todavía no hay historial de cotizaciones para este jugador.
        </p>
      </div>
    );
  }

  // Un punto por fecha: el último recálculo del día
  const byDate = new Map<string, PlayerQuote>();
  for (const q of quotes) {
    byDate.set(toDateKey(q.calculatedAt), q);
  }
  const deduplicated = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime(),
  );

  const values = deduplicated.map((q) => q.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const timestamps = deduplicated.map((q) => new Date(q.calculatedAt).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  const plotWidth = VIEW_WIDTH - PADDING_X * 2;
  const plotHeight = VIEW_HEIGHT - PADDING_Y * 2;

  const points: PlotPoint[] = deduplicated.map((quote) => {
    const t = new Date(quote.calculatedAt).getTime();
    const x = PADDING_X + (deduplicated.length === 1 ? plotWidth / 2 : ((t - minTime) / timeRange) * plotWidth);
    const y = PADDING_Y + plotHeight - ((quote.value - minValue) / valueRange) * plotHeight;
    return { x, y, quote };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="rounded-xl border border-white/8 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Tu valuación de este jugador en el tiempo"
          onMouseLeave={() => setHovered(null)}
        >
          <line
            x1={PADDING_X} y1={VIEW_HEIGHT - PADDING_Y}
            x2={VIEW_WIDTH - PADDING_X} y2={VIEW_HEIGHT - PADDING_Y}
            stroke="rgba(255,255,255,0.1)" strokeWidth={1}
          />

          {hovered && (
            <line
              x1={hovered.x} y1={PADDING_Y}
              x2={hovered.x} y2={VIEW_HEIGHT - PADDING_Y}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3"
            />
          )}

          {points.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p) => {
            const isHovered = hovered?.quote.id === p.quote.id;
            return (
              <circle
                key={p.quote.id}
                cx={p.x} cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? '#fff' : color}
                stroke={isHovered ? color : 'rgba(0,0,0,0.3)'}
                strokeWidth={isHovered ? 2 : 1}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(p)}
              />
            );
          })}
        </svg>

        {hovered && (() => {
          const pct = (hovered.x - PADDING_X) / plotWidth;
          const alignRight = pct > 0.55;
          return (
            <div
              className="absolute bottom-full mb-1 z-10 pointer-events-none"
              style={{
                left: alignRight ? undefined : `${pct * 100}%`,
                right: alignRight ? `${(1 - pct) * 100}%` : undefined,
              }}
            >
              <div className="bg-[#0b3332] border border-[#1a6866] rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                  {formatDate(hovered.quote.calculatedAt)}
                </p>
                <p className="text-[12px] font-black tabular-nums" style={{ color }}>
                  {formatCurrency(hovered.quote.value)}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  Score: <span className="text-white font-bold">{hovered.quote.score.toFixed(2)}</span>
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center justify-between mt-2 text-[9px] font-bold uppercase tracking-wider text-white/40">
        <span>{formatDate(deduplicated[0].calculatedAt)}</span>
        <span>{deduplicated.length > 1 ? formatDate(deduplicated[deduplicated.length - 1].calculatedAt) : ''}</span>
      </div>
    </div>
  );
};
