import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface StrategyCompositionChartProps {
  weights: Record<string, number>;
}

const BAR_COLOR = '#b79753';

export const StrategyCompositionChart: React.FC<StrategyCompositionChartProps> = ({ weights }) => {
  const entries = Object.entries(weights);

  if (entries.length === 0) {
    return (
      <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] text-center">
        <p className="text-xs text-gray-400">Esta estrategia todavía no tiene pesos configurados.</p>
      </div>
    );
  }

  const data = entries.map(([factor, weight]) => ({ factor, weight }));

  return (
    <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-2">
      <h4 className="text-xs font-black uppercase tracking-wider text-white">
        Composición de la estrategia
      </h4>
      <div style={{ width: '100%', height: 32 * data.length + 40 }} role="img" aria-label="Composición de pesos de la estrategia">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
            <XAxis type="number" hide domain={[0, 1]} />
            <YAxis
              type="category"
              dataKey="factor"
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 10 }}
              width={90}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip
              formatter={(value) => Number(value).toFixed(3)}
              contentStyle={{ backgroundColor: '#0b3332', border: '1px solid #1a6866', borderRadius: 8 }}
              labelStyle={{ color: '#fff', fontWeight: 700 }}
            />
            <Bar dataKey="weight" isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.factor} fill={BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
