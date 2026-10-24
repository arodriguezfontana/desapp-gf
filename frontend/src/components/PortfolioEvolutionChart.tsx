import React, { type ReactNode } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  type TooltipContentProps,
  type DotItemDotProps,
} from 'recharts';
import type { TokenTransactionDto } from '../types/orders.types';

interface Props {
  transactions: TokenTransactionDto[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

interface ChartPoint {
  t: number;
  value: number;
  tx: TokenTransactionDto | null;
}

const EvolutionTooltip = ({ active, payload }: TooltipContentProps): ReactNode => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload as ChartPoint;
  if (!point.tx) {
    return null;
  }
  const tx = point.tx;
  const isCredit = tx.type === 'CREDIT';
  const amount = Number(tx.price) * tx.quantity;
  const sign = isCredit ? '+' : '-';
  const color = isCredit ? '#a78bfa' : '#f59e0b';

  return (
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
          <span className="text-white font-black">{formatCurrency(point.value)}</span>
        </p>
      </div>
    </div>
  );
};

export const PortfolioEvolutionChart: React.FC<Props> = ({ transactions }) => {
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
  const series: ChartPoint[] = [];
  for (const tx of sorted) {
    const amount = Number(tx.price) * tx.quantity;
    cumulative += tx.type === 'CREDIT' ? amount : -amount;
    series.push({ t: new Date(tx.createdAt).getTime(), value: cumulative, tx });
  }

  const firstT = series[0].t - 1;
  const data: ChartPoint[] = [{ t: firstT, value: 0, tx: null }, ...series];

  const minV = Math.min(0, ...data.map((p) => p.value));
  const lastPt = data[data.length - 1];
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

      <div style={{ width: '100%', height: 180 }} role="img" aria-label="Evolución del capital invertido">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => formatDate(new Date(t).toISOString())}
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 8 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 8 }}
              tickFormatter={(v: number) => formatCurrency(v)}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            {minV < 0 && <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" />}
            <Tooltip content={EvolutionTooltip} />
            <Area
              type="linear"
              dataKey="value"
              stroke="#2dd4bf"
              strokeWidth={2}
              fill="url(#portfolioGrad)"
              dot={(props: DotItemDotProps) => {
                const { cx, cy, index } = props;
                const payload = props.payload as ChartPoint;
                if (!payload.tx) {
                  return <circle key={index} cx={cx} cy={cy} r={0} />;
                }
                const dotColor = payload.tx.type === 'CREDIT' ? '#a78bfa' : '#f59e0b';
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={dotColor}
                    stroke="#104443"
                    strokeWidth={1.5}
                    className="recharts-dot"
                  />
                );
              }}
              activeDot={{ r: 6, fill: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
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
