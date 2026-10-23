import React, { useMemo, useState } from 'react';
import type { OrderResponseDto } from '../types/orders.types';

interface MyOrdersProps {
  orders: OrderResponseDto[];
  isLoading: boolean;
  cancellingOrderId: string | null;
  error: string | null;
  onCancelOrder: (orderId: string) => Promise<boolean>;
  hideHeader?: boolean;
}

const PAGE_SIZE = 8;

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const MyOrders: React.FC<MyOrdersProps> = ({
  orders,
  isLoading,
  cancellingOrderId,
  error,
  onCancelOrder,
  hideHeader = false,
}) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [orders, currentPage],
  );

  return (
    <section aria-label="Mis órdenes" className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
            Mis Órdenes ({isLoading ? '…' : orders.length})
          </h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#104443] px-3 py-1 rounded-full border border-[#b79753]/30">
            MERCADO
          </span>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-10 bg-[#104443] rounded-2xl border border-[#1a6866]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#1a6866] border-t-[#b79753] mb-3" />
          <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando órdenes...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center">
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-10 text-center space-y-3">
          <div className="text-3xl">📄</div>
          <p className="text-sm font-semibold text-gray-300">
            Aún no has creado órdenes. Tus posturas de compra y venta abiertas y finalizadas aparecerán acá.
          </p>
        </div>
      )}

      {!isLoading && !error && orders.length > 0 && (
        <>
          {/* Tabla — pantallas medianas y grandes */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#1a6866] bg-[#104443] shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1a6866] bg-[#0e3b3a] text-[10px] font-black uppercase tracking-widest text-[#b79753]">
                  <th scope="col" className="py-4 px-6">Tipo</th>
                  <th scope="col" className="py-4 px-6 text-right">Cantidad</th>
                  <th scope="col" className="py-4 px-6 text-right">Remanente</th>
                  <th scope="col" className="py-4 px-6 text-right">Precio Unit.</th>
                  <th scope="col" className="py-4 px-6 text-center">Estado</th>
                  <th scope="col" className="py-4 px-6 text-right">Fecha</th>
                  <th scope="col" className="py-4 px-6 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a6866]/60 text-xs sm:text-sm font-semibold">
                {pageItems.map((order) => {
                  const isBuy = order.side === 'BUY';
                  const typeColor = isBuy ? 'text-emerald-400' : 'text-rose-400';
                  const typeLabel = isBuy ? 'COMPRA' : 'VENTA';
                  const isCancellable = order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED';
                  const isCancelling = cancellingOrderId === order.id;

                  let statusBadge = (
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-gray-500/20 text-gray-400 border border-gray-500/30">
                      CANCELADA
                    </span>
                  );
                  if (order.status === 'PENDING') {
                    statusBadge = (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        PENDIENTE
                      </span>
                    );
                  } else if (order.status === 'PARTIALLY_FILLED') {
                    statusBadge = (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        PARCIAL
                      </span>
                    );
                  } else if (order.status === 'COMPLETED') {
                    statusBadge = (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        COMPLETADA
                      </span>
                    );
                  }

                  return (
                    <tr key={order.id} className="hover:bg-[#165756]/50 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`font-black text-[10px] uppercase tracking-widest ${typeColor}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-gray-200">{order.quantity}</td>
                      <td className="py-4 px-6 text-right text-gray-200">{order.remainingQuantity}</td>
                      <td className="py-4 px-6 text-right text-gray-300">{formatCurrency(order.price)}</td>
                      <td className="py-4 px-6 text-center">{statusBadge}</td>
                      <td className="py-4 px-6 text-right text-gray-400 text-[11px]">{formatDate(order.createdAt)}</td>
                      <td className="py-4 px-6 text-center">
                        {isCancellable ? (
                          <button
                            type="button"
                            disabled={isCancelling}
                            onClick={() => void onCancelOrder(order.id)}
                            aria-label={`Cancelar orden ${order.id}`}
                            className="bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-rose-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {isCancelling ? 'Cancelando...' : 'Cancelar'}
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas — pantallas móviles */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {pageItems.map((order) => {
              const isBuy = order.side === 'BUY';
              const typeColor = isBuy ? 'text-emerald-400' : 'text-rose-400';
              const typeLabel = isBuy ? 'COMPRA' : 'VENTA';
              const isCancellable = order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED';
              const isCancelling = cancellingOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-[#104443] border border-[#1a6866] rounded-xl p-5 shadow-lg space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#1a6866] pb-2">
                    <span className={`text-xs font-black uppercase tracking-wider ${typeColor} bg-[#0b3332] px-2.5 py-1 rounded-md`}>
                      {typeLabel}
                    </span>
                    <div>
                      {order.status === 'PENDING' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          PENDIENTE
                        </span>
                      )}
                      {order.status === 'PARTIALLY_FILLED' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          PARCIAL
                        </span>
                      )}
                      {order.status === 'COMPLETED' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          COMPLETADA
                        </span>
                      )}
                      {order.status === 'CANCELLED' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                          CANCELADA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gray-400 block">Cantidad</span>
                      <span className="text-gray-200 font-semibold">{order.quantity}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gray-400 block">Remanente</span>
                      <span className="text-gray-200 font-semibold">{order.remainingQuantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-400 block">Precio</span>
                      <span className="text-gray-200 font-semibold">{formatCurrency(order.price)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1a6866]/60">
                    <span className="text-[10px] text-gray-400">{formatDate(order.createdAt)}</span>
                    {isCancellable && (
                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={() => void onCancelOrder(order.id)}
                        aria-label={`Cancelar orden ${order.id}`}
                        className="bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-rose-500/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isCancelling ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-200 bg-[#104443] border border-[#1a6866] rounded-xl hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-200 bg-[#104443] border border-[#1a6866] rounded-xl hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

