import React from 'react';
import type { OrderBookResponseDto } from '../types/orders.types';

interface OrderBookViewProps {
  orderBook: OrderBookResponseDto | null;
  isLoading: boolean;
  error: string | null;
  onReload?: () => void;
}

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export const OrderBookView: React.FC<OrderBookViewProps> = ({
  orderBook,
  isLoading,
  error,
  onReload,
}) => {
  const bids = orderBook?.bids ?? [];
  const asks = orderBook?.asks ?? [];
  const isEmpty = bids.length === 0 && asks.length === 0;

  // Encontrar el volumen máximo individual entre todos los niveles para escalar las barras de profundidad
  const maxVolume = Math.max(
    1,
    ...bids.map((b) => b.totalQuantity),
    ...asks.map((a) => a.totalQuantity),
  );

  const totalBidVolume = bids.reduce((acc, b) => acc + b.totalQuantity, 0);
  const totalAskVolume = asks.reduce((acc, a) => acc + a.totalQuantity, 0);

  return (
    <section aria-label="Libro de órdenes" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
            Profundidad de Mercado
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Órdenes activas consolidadas por nivel de precio (Order Book Level 2)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              disabled={isLoading}
              className="text-xs font-bold text-[#b79753] bg-[#0c2f2e] hover:bg-[#1a6866] border border-[#b79753]/30 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Actualizando...' : 'Actualizar'}
            </button>
          )}
          <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#104443] px-3 py-1.5 rounded-full border border-[#b79753]/30">
            SNAPSHOT
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-10 bg-[#104443] rounded-2xl border border-[#1a6866]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#1a6866] border-t-[#b79753] mb-3" />
          <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">
            Cargando libro de órdenes...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center">
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {!isLoading && !error && isEmpty && (
        <div className="text-center py-10 bg-[#104443] rounded-2xl border border-[#1a6866] text-neutral-400">
          <p className="text-sm font-bold text-white mb-1">
            No hay órdenes activas en el mercado para este jugador
          </p>
          <p className="text-xs text-neutral-400">
            Sé el primero en crear una orden de compra o venta para iniciar la liquidez.
          </p>
        </div>
      )}

      {!isLoading && !error && !isEmpty && (
        <div className="bg-[#104443] rounded-2xl border border-[#1a6866] p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna de Compras (Bids) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1a6866]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                    Compras (Bids)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-neutral-400">
                  Total: {totalBidVolume} tokens
                </span>
              </div>

              {bids.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">
                  Sin posturas de compra activas
                </p>
              ) : (
                <div className="space-y-1.5" data-testid="bids-list">
                  <div className="grid grid-cols-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-1">
                    <span>Precio</span>
                    <span className="text-right">Cantidad</span>
                  </div>
                  {bids.map((bid, index) => {
                    const depthPct = Math.min(100, (bid.totalQuantity / maxVolume) * 100);
                    return (
                      <div
                        key={`bid-${bid.price}-${index}`}
                        className="relative grid grid-cols-2 text-sm px-3 py-2 rounded-lg font-mono overflow-hidden items-center"
                      >
                        {/* Barra de profundidad visual */}
                        <div
                          className="absolute inset-y-0 right-0 bg-emerald-500/20 rounded-lg pointer-events-none transition-all duration-300"
                          style={{ width: `${depthPct}%` }}
                          data-testid="bid-depth-bar"
                        />
                        <span className="relative z-10 text-emerald-400 font-bold">
                          {formatCurrency(bid.price)}
                        </span>
                        <span className="relative z-10 text-right text-white font-semibold">
                          {bid.totalQuantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Columna de Ventas (Asks) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1a6866]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-400">
                    Ventas (Asks)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-neutral-400">
                  Total: {totalAskVolume} tokens
                </span>
              </div>

              {asks.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">
                  Sin posturas de venta activas
                </p>
              ) : (
                <div className="space-y-1.5" data-testid="asks-list">
                  <div className="grid grid-cols-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-1">
                    <span>Precio</span>
                    <span className="text-right">Cantidad</span>
                  </div>
                  {asks.map((ask, index) => {
                    const depthPct = Math.min(100, (ask.totalQuantity / maxVolume) * 100);
                    return (
                      <div
                        key={`ask-${ask.price}-${index}`}
                        className="relative grid grid-cols-2 text-sm px-3 py-2 rounded-lg font-mono overflow-hidden items-center"
                      >
                        {/* Barra de profundidad visual */}
                        <div
                          className="absolute inset-y-0 right-0 bg-rose-500/20 rounded-lg pointer-events-none transition-all duration-300"
                          style={{ width: `${depthPct}%` }}
                          data-testid="ask-depth-bar"
                        />
                        <span className="relative z-10 text-rose-400 font-bold">
                          {formatCurrency(ask.price)}
                        </span>
                        <span className="relative z-10 text-right text-white font-semibold">
                          {ask.totalQuantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

