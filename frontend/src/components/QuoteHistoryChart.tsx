import React from 'react';
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

/**
 * Gráfico de líneas de solo lectura con la evolución del valor del token de un
 * jugador en el tiempo (015-player-quote-history, spec FR-008/FR-009). SVG
 * inline propio, sin librería de charting (ver research.md Decisión 3 de la
 * feature): una sola serie no necesita leyenda — el título ya la nombra.
 */
export const QuoteHistoryChart: React.FC<QuoteHistoryChartProps> = ({ quotes, color = '#2dd4bf' }) => {
  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 py-8 px-5 text-center" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <p className="text-xs font-bold text-white/40 uppercase tracking-wider">
          Todavía no hay historial de cotizaciones para este jugador.
        </p>
      </div>
    );
  }

  const values = quotes.map((q) => q.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1; // evita división por 0 si todos los valores son iguales

  const timestamps = quotes.map((q) => new Date(q.calculatedAt).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1; // evita división por 0 con un solo punto (o timestamps iguales)

  const plotWidth = VIEW_WIDTH - PADDING_X * 2;
  const plotHeight = VIEW_HEIGHT - PADDING_Y * 2;

  const points = quotes.map((quote) => {
    const t = new Date(quote.calculatedAt).getTime();
    const x = PADDING_X + (quotes.length === 1 ? plotWidth / 2 : ((t - minTime) / timeRange) * plotWidth);
    const y = PADDING_Y + plotHeight - ((quote.value - minValue) / valueRange) * plotHeight;
    return { x, y, quote };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="rounded-xl border border-white/8 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Evolución del valor del token en el tiempo"
      >
        {/* Línea base (eje X), recesiva */}
        <line
          x1={PADDING_X}
          y1={VIEW_HEIGHT - PADDING_Y}
          x2={VIEW_WIDTH - PADDING_X}
          y2={VIEW_HEIGHT - PADDING_Y}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />

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

        {points.map((p) => (
          <circle key={p.quote.id} cx={p.x} cy={p.y} r={4} fill={color}>
            <title>{`${formatDate(p.quote.calculatedAt)}: ${Math.round(p.quote.value)}`}</title>
          </circle>
        ))}
      </svg>

      {/* Etiquetas directas en los extremos — nunca un número por cada punto */}
      <div className="flex items-center justify-between mt-2 text-[9px] font-bold uppercase tracking-wider text-white/40">
        <span>{formatDate(quotes[0].calculatedAt)}</span>
        <span>{formatDate(quotes[quotes.length - 1].calculatedAt)}</span>
      </div>
    </div>
  );
};
