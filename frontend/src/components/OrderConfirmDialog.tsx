import { useState } from 'react';
import type { OrderSide } from '../types/orders.types';

interface OrderConfirmDialogProps {
  readonly side: OrderSide;
  readonly playerName: string;
  /** Precio de la estrategia seleccionada del usuario, ya cargado en la página (GET /players/:id/valuation) — nunca se recalcula ni se edita acá. */
  readonly price: number;
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly onConfirm: (quantity: number) => void;
  readonly onCancel: () => void;
}

const SIDE_LABEL: Record<OrderSide, string> = { BUY: 'Comprar', SELL: 'Vender' };

export function OrderConfirmDialog({
  side,
  playerName,
  price,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: OrderConfirmDialogProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const accent = side === 'BUY' ? '#34d399' : '#fb7185';
  const isValid = Number.isInteger(quantity) && quantity > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b3332]/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#104443] border-2 border-[#b79753] p-6 sm:p-8 shadow-2xl rounded-2xl relative overflow-hidden text-white">
        <div className="h-1.5 absolute top-0 inset-x-0" style={{ backgroundColor: accent }} />

        <div className="flex items-center gap-2.5 mb-3 pt-2">
          <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: accent }} />
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            {SIDE_LABEL[side]} tokens de {playerName}
          </h2>
        </div>

        <p className="text-xs sm:text-sm font-medium text-gray-300 leading-relaxed mb-4">
          El precio se calcula automáticamente con tu estrategia seleccionada — no lo elegís vos.
          Si existe una orden compatible en el libro, la operación se ejecuta de inmediato; si no,
          queda pendiente hasta que aparezca una contraparte al mismo precio exacto.
        </p>

        <div className="mb-4 p-3 bg-black/25 border border-white/10 rounded-xl flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/60">
            Precio por token
          </span>
          <span className="text-xl font-black tabular-nums" style={{ color: accent }}>
            {price.toFixed(2)}
          </span>
        </div>

        <div className="mb-4">
          <label
            htmlFor="order-quantity"
            className="block text-[11px] font-black uppercase tracking-widest text-gray-300 mb-1.5"
          >
            Cantidad de tokens
          </label>
          <input
            id="order-quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10))}
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-[#0b3332] border border-[#1a6866] text-white font-mono text-sm focus:outline-none rounded-xl shadow-inner"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#f43f5e]/15 border-l-4 border-[#f43f5e] text-[#f43f5e] font-bold text-xs rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[#1a6866]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-widest border border-[#1a6866] text-gray-300 hover:bg-[#1a6866] transition-all rounded-xl cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => isValid && onConfirm(quantity)}
            disabled={isSubmitting || !isValid}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-[#0b3332] shadow-lg transition-all rounded-xl cursor-pointer border border-white/20 active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {isSubmitting ? 'Procesando...' : `Confirmar ${SIDE_LABEL[side].toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
