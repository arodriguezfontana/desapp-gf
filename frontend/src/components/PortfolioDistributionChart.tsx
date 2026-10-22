import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { Holding } from '../types/portfolio';

interface PortfolioDistributionChartProps {
  holdings: Holding[];
}

const COLORS = ['#2dd4bf', '#b79753', '#a78bfa', '#f59e0b', '#fb7185', '#34d399', '#60a5fa', '#f472b6'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const PortfolioDistributionChart: React.FC<PortfolioDistributionChartProps> = ({ holdings }) => {
  if (holdings.length === 0) {
    return (
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-6 shadow-xl text-center">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-4">
          Distribución del Portfolio
        </h3>
        <p className="text-xs text-gray-400 py-8">Aún no tenés posiciones en tu portfolio.</p>
      </div>
    );
  }

  const data = holdings.map((holding) => ({
    name: holding.playerName,
    value: holding.tokenQuantity * holding.currentPrice,
  }));

  return (
    <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-5 shadow-xl">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-4">
        Distribución del Portfolio
      </h3>
      <div style={{ width: '100%', height: 240 }} role="img" aria-label="Distribución del valor del portfolio por jugador">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ backgroundColor: '#0b3332', border: '1px solid #1a6866', borderRadius: 8 }}
              labelStyle={{ color: '#fff', fontWeight: 700 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-gray-300">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            {entry.name}
          </li>
        ))}
      </ul>
    </div>
  );
};
