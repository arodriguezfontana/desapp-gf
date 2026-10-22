import React from 'react';
import type { PriceLevelDto } from '../types/orders.types';

interface OrderBookDepthChartProps {
  bids: PriceLevelDto[];
  asks: PriceLevelDto[];
}

interface PriceRow {
  price: number;
  bidQty: number;
  askQty: number;
}

function buildRows(bids: PriceLevelDto[], asks: PriceLevelDto[]): PriceRow[] {
  const byPrice = new Map<number, PriceRow>();

  for (const b of bids) {
    const p = Number(b.price);
    const row = byPrice.get(p) ?? { price: p, bidQty: 0, askQty: 0 };
    row.bidQty += b.totalQuantity;
    byPrice.set(p, row);
  }
  for (const a of asks) {
    const p = Number(a.price);
    const row = byPrice.get(p) ?? { price: p, bidQty: 0, askQty: 0 };
    row.askQty += a.totalQuantity;
    byPrice.set(p, row);
  }

  return Array.from(byPrice.values()).sort((a, b) => a.price - b.price);
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

export const OrderBookDepthChart: React.FC<OrderBookDepthChartProps> = ({ bids, asks }) => {
  const rows = buildRows(bids, asks);

  if (rows.length === 0) return null;

  const maxQty = Math.max(...rows.map((r) => Math.max(r.bidQty, r.askQty)), 1);

  return (
    <div
      className="bg-[#0b3332] rounded-xl border border-[#1a6866] p-4 space-y-3"
      role="img"
      aria-label="Profundidad del libro de órdenes por nivel de precio"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-white">Profundidad de mercado</h4>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Compra
          </span>
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Venta
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-1 text-[9px] font-black uppercase tracking-wider">
        <span className="text-right text-emerald-400">Vol.</span>
        <span className="text-center text-gray-400 px-2">Precio</span>
        <span className="text-left text-rose-400">Vol.</span>
      </div>

      <div className="space-y-1">
        {rows.map((row) => {
          const bidPct = (row.bidQty / maxQty) * 100;
          const askPct = (row.askQty / maxQty) * 100;
          const isBid = row.bidQty > 0;
          const isAsk = row.askQty > 0;

          return (
            <div key={row.price} className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center">
              <div className="flex items-center justify-end gap-1.5">
                {isBid && (
                  <span className="text-[9px] font-bold text-emerald-300 shrink-0">{row.bidQty}</span>
                )}
                <div className="flex-1 flex justify-end h-4">
                  <div
                    data-testid="bid-depth-bar"
                    className="h-full bg-emerald-400/30 border-r border-emerald-400 rounded-l-sm"
                    style={{ width: isBid ? `${bidPct}%` : '0%' }}
                  />
                </div>
              </div>

              <span className="text-[9px] font-bold text-white px-2 text-center whitespace-nowrap">
                {fmt(row.price)}
              </span>

              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-4">
                  <div
                    data-testid="ask-depth-bar"
                    className="h-full bg-rose-400/30 border-l border-rose-400 rounded-r-sm"
                    style={{ width: isAsk ? `${askPct}%` : '0%' }}
                  />
                </div>
                {isAsk && (
                  <span className="text-[9px] font-bold text-rose-300 shrink-0">{row.askQty}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
