import React, { type ReactNode } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import type { PlayerQuote } from '../types/catalog.types';

interface QuoteHistoryChartProps {
  quotes: PlayerQuote[];
  color?: string;
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const toDateKey = (iso: string) => iso.slice(0, 10); // 'YYYY-MM-DD'

interface ChartPoint {
  t: number;
  value: number;
  score: number;
  calculatedAt: string;
}

const QuoteTooltip = ({ active, payload }: TooltipContentProps): ReactNode => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload as ChartPoint;
  return (
    <div className="bg-[#0b3332] border border-[#1a6866] rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
        {formatDate(point.calculatedAt)}
      </p>
      <p className="text-[12px] font-black tabular-nums" style={{ color: payload[0].color }}>
        {formatCurrency(point.value)}
      </p>
      <p className="text-[9px] text-gray-400 mt-0.5">
        Score: <span className="text-white font-bold">{point.score.toFixed(2)}</span>
      </p>
    </div>
  );
};

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

  // Un punto por fecha: el último recálculo del día
  const byDate = new Map<string, PlayerQuote>();
  for (const q of quotes) {
    byDate.set(toDateKey(q.calculatedAt), q);
  }
  const deduplicated = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime(),
  );

  const data: ChartPoint[] = deduplicated.map((q) => ({
    t: new Date(q.calculatedAt).getTime(),
    value: q.value,
    score: q.score,
    calculatedAt: q.calculatedAt,
  }));

  return (
    <div className="rounded-xl border border-white/8 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <div
        role="img"
        aria-label="Tu valuación de este jugador en el tiempo"
        style={{ width: '100%', height: 160 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => formatDate(new Date(t).toISOString())}
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 9 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip content={QuoteTooltip} />
            <Line
              type="linear"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, fill: color, strokeWidth: 1 }}
              activeDot={{ r: 6, fill: '#fff', stroke: color, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-2 text-[9px] font-bold uppercase tracking-wider text-white/40">
        <span>{formatDate(deduplicated[0].calculatedAt)}</span>
        <span>{deduplicated.length > 1 ? formatDate(deduplicated[deduplicated.length - 1].calculatedAt) : ''}</span>
      </div>
    </div>
  );
};
