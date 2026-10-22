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

/** Lista de alertas propias con acción de cancelar (025-player-price-alerts, FR-005, FR-006). */
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

  if (alerts.length === 0) {
    return <p className="text-sm text-gray-300">Todavía no tenés alertas de precio.</p>;
  }

  return (
    <ul aria-label="Mis alertas de precio" className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className="flex items-center justify-between bg-[#104443] border border-[#1a6866] rounded-xl px-4 py-3"
        >
          <span className="text-sm text-white">
            {CONDITION_LABEL[alert.condition]} {alert.targetValue}{' '}
            <span className="text-xs text-gray-400">({alert.status})</span>
          </span>
          {alert.status === 'ACTIVE' && (
            <button
              onClick={() => handleCancel(alert.id)}
              disabled={cancellingId === alert.id}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#f43f5e] hover:bg-[#e11d48] rounded-lg disabled:opacity-50"
            >
              {cancellingId === alert.id ? 'Cancelando...' : 'Cancelar'}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
