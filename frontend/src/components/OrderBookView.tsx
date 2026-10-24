import React from 'react';
import type { OrderBookResponseDto } from '../types/orders.types';
import { OrderBookDepthChart } from './OrderBookDepthChart';

interface OrderBookViewProps {
  orderBook: OrderBookResponseDto | null;
  isLoading: boolean;
  error: string | null;
  onReload?: () => void;
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
        <OrderBookDepthChart bids={bids} asks={asks} />
      )}
    </section>
  );
};

