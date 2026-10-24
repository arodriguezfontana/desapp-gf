import React, { useState } from 'react';
import type { PriceAlertResponseDto } from '../types/alerts.types';

interface PlayerAlertsListProps {
  alerts: PriceAlertResponseDto[];
  isLoading: boolean;
  error: string | null;
  onCancel: (alertId: string) => Promise<void>;
}

const CONDITION_LABEL: Record<PriceAlertResponseDto['condition'], string> = {
  PRICE_BELOW: 'baja de',
  PRICE_ABOVE: 'sube de',
};

/** Lista de alertas propias como chips, con acción de cancelar (025-player-price-alerts, FR-005, FR-006). */
export const PlayerAlertsList: React.FC<PlayerAlertsListProps> = ({ alerts, isLoading, error, onCancel }) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (alertId: string) => {
    setCancellingId(alertId);
    try {
      await onCancel(alertId);
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando alertas...</p>;
  }

  if (error) {
    return <p className="text-sm font-bold text-[#f43f5e]">{error}</p>;
  }

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  if (activeAlerts.length === 0) {
    return <p className="text-xs text-gray-400">Todavía no tenés alertas de precio para este jugador.</p>;
  }

  return (
    <div aria-label="Mis alertas de precio" className="flex flex-wrap items-center gap-2">
      {activeAlerts.map((alert) => (
        <span
          key={alert.id}
          className="inline-flex items-center gap-1.5 bg-[#0b3332] border border-[#2dd4bf]/40 text-[#2dd4bf] text-xs font-bold px-3 py-1.5 rounded-full"
        >
          {CONDITION_LABEL[alert.condition]} {alert.targetValue}
          <button
            type="button"
            onClick={() => handleCancel(alert.id)}
            disabled={cancellingId === alert.id}
            aria-label={`Cancelar alerta ${CONDITION_LABEL[alert.condition]} ${alert.targetValue}`}
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[#2dd4bf]/70 hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 disabled:opacity-40 cursor-pointer transition-colors"
          >
            {cancellingId === alert.id ? '…' : '✕'}
          </button>
        </span>
      ))}
    </div>
  );
};
