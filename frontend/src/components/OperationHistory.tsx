import React from 'react';
import { Link } from 'react-router-dom';
import type { TokenTransactionDto } from '../types/orders.types';

interface OperationHistoryProps {
  transactions: TokenTransactionDto[];
  isLoading: boolean;
  error: string | null;
}

function formatCurrency(amount: string): string {
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

export const OperationHistory: React.FC<OperationHistoryProps> = ({ transactions, isLoading, error }) => {
  return (
    <section aria-label="Historial de operaciones" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
          Historial de Operaciones ({isLoading ? '…' : transactions.length})
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#104443] px-3 py-1 rounded-full border border-[#b79753]/30">
          HISTORIAL
        </span>
      </div>

      {isLoading && (
        <div className="text-center py-10 bg-[#104443] rounded-2xl border border-[#1a6866]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#1a6866] border-t-[#b79753] mb-3" />
          <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando historial...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center">
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-10 text-center space-y-3">
          <div className="text-3xl">📋</div>
          <p className="text-sm font-semibold text-gray-300">
            Aún no tenés operaciones ejecutadas. Las compras y ventas completadas aparecerán acá.
          </p>
        </div>
      )}

      {!isLoading && !error && transactions.length > 0 && (
        <>
          {/* Tabla — pantallas medianas y grandes */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#1a6866] bg-[#104443] shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1a6866] bg-[#0e3b3a] text-[10px] font-black uppercase tracking-widest text-[#b79753]">
                  <th scope="col" className="py-4 px-6">Tipo</th>
                  <th scope="col" className="py-4 px-6">Jugador</th>
                  <th scope="col" className="py-4 px-6 text-right">Cantidad</th>
                  <th scope="col" className="py-4 px-6 text-right">Precio Unit.</th>
                  <th scope="col" className="py-4 px-6 text-right">Total</th>
                  <th scope="col" className="py-4 px-6 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a6866]/60 text-xs sm:text-sm font-semibold">
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT';
                  const typeColor = isCredit ? 'text-[#6ab547]' : 'text-red-400';
                  const typeLabel = isCredit ? 'COMPRA' : 'VENTA';
                  const total = (Number(tx.price) * tx.quantity).toFixed(2);
                  return (
                    <tr key={tx.id} className="hover:bg-[#165756]/50 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`font-black text-[10px] uppercase tracking-widest ${typeColor}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-black uppercase text-white tracking-wide">
                        <Link
                          to={`/catalog/${tx.playerId}`}
                          className="hover:text-[#2dd4bf] transition-colors"
                        >
                          {tx.playerName}
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-right text-gray-200">{tx.quantity}</td>
                      <td className="py-4 px-6 text-right text-gray-300">{formatCurrency(tx.price)}</td>
                      <td className={`py-4 px-6 text-right font-black ${typeColor}`}>
                        {isCredit ? '-' : '+'}{formatCurrency(total)}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-400 text-[11px]">{formatDate(tx.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas — móviles */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {transactions.map((tx) => {
              const isCredit = tx.type === 'CREDIT';
              const typeColor = isCredit ? 'text-[#6ab547]' : 'text-red-400';
              const typeLabel = isCredit ? 'COMPRA' : 'VENTA';
              const total = (Number(tx.price) * tx.quantity).toFixed(2);
              return (
                <div
                  key={tx.id}
                  className="bg-[#104443] border border-[#1a6866] rounded-xl p-5 shadow-lg space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#1a6866] pb-2">
                    <Link
                      to={`/catalog/${tx.playerId}`}
                      className="font-black uppercase text-white text-base hover:text-[#2dd4bf] transition-colors"
                    >
                      {tx.playerName}
                    </Link>
                    <span className={`text-xs font-black uppercase tracking-wider ${typeColor} bg-[#0b3332] px-2.5 py-1 rounded-md`}>
                      {typeLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gray-400 block">Cantidad</span>
                      <span className="text-gray-200 font-semibold">{tx.quantity} tokens</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-400 block">Precio Unit.</span>
                      <span className="text-gray-200 font-semibold">{formatCurrency(tx.price)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#1a6866]/60">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">Total</span>
                    <span className={`font-black text-sm ${typeColor}`}>
                      {isCredit ? '-' : '+'}{formatCurrency(total)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 text-right">{formatDate(tx.createdAt)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
