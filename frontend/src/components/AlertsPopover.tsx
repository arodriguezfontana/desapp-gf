import React, { useState } from 'react';
import type { AlertCondition, PriceAlertResponseDto } from '../types/alerts.types';
import { CreateAlertForm } from './CreateAlertForm';
import { PlayerAlertsList } from './PlayerAlertsList';

interface AlertsPopoverProps {
  playerId: string;
  alerts: PriceAlertResponseDto[];
  isLoadingAlerts: boolean;
  alertsError: string | null;
  onCreate: (playerId: string, condition: AlertCondition, targetValue: number) => Promise<unknown>;
  onCancel: (alertId: string) => Promise<void>;
}

/**
 * Botón de campanita junto al valor del token que abre un modal centrado
 * con el formulario de alertas y las alertas activas
 * (025-player-price-alerts). Modal en vez de popover anclado: un popover
 * quedaba tapado por el resto de la info del jugador en pantallas chicas.
 */
export const AlertsPopover: React.FC<AlertsPopoverProps> = ({
  playerId,
  alerts,
  isLoadingAlerts,
  alertsError,
  onCreate,
  onCancel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label="Alertas de precio"
        className="relative px-4 py-2 text-[11px] font-black uppercase tracking-widest bg-[#0b3332]/80 hover:bg-[#165756] border border-[#b79753]/40 text-[#b79753] shadow-md transition-all rounded-xl cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
      >
        <span aria-hidden="true">🔔</span>
        <span>Alertas</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black bg-[#b79753] text-[#0b3332] rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b3332]/80 backdrop-blur-md p-4 animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Alertas de precio"
            className="w-full max-w-md bg-[#104443] border-2 border-[#b79753] p-6 sm:p-8 shadow-2xl rounded-2xl relative overflow-hidden text-white space-y-4"
          >
            <div className="h-1.5 absolute top-0 inset-x-0 bg-[#b79753]" />

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Alertas de precio</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar"
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <CreateAlertForm playerId={playerId} onCreate={onCreate} />

            <div className="pt-4 border-t border-[#1a6866]">
              <PlayerAlertsList
                alerts={alerts}
                isLoading={isLoadingAlerts}
                error={alertsError}
                onCancel={onCancel}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
