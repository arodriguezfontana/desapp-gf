import React from 'react';
import { Link } from 'react-router-dom';
import type { NotificationResponseDto } from '../types/notifications.types';

interface NotificationTrayProps {
  notifications: NotificationResponseDto[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
}

const CONDITION_LABEL: Record<NotificationResponseDto['condition'], string> = {
  PRICE_BELOW: 'bajó de',
  PRICE_ABOVE: 'subió de',
};

/**
 * Bandeja de notificaciones: más recientes primero, acción de marcar como
 * leída (025-player-price-alerts, FR-014, FR-016).
 */
export const NotificationTray: React.FC<NotificationTrayProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  return (
    <div className="w-80 max-h-96 overflow-y-auto bg-[#0e3b3a] border border-[#1a6866] rounded-xl shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a6866]">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#b79753]">Notificaciones</h3>
        <button
          onClick={onMarkAllAsRead}
          className="text-[10px] font-bold uppercase tracking-wider text-[#2dd4bf] hover:text-white"
        >
          Marcar todas como leídas
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-300 text-center">No tenés notificaciones todavía.</p>
      ) : (
        <ul aria-label="Mis notificaciones" className="divide-y divide-[#1a6866]">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`px-4 py-3 ${notification.read ? 'opacity-60' : ''}`}
            >
              <Link
                to={`/catalog/${notification.playerId}`}
                onClick={() => {
                  if (!notification.read) {
                    onMarkAsRead(notification.id);
                  }
                }}
                className="block w-full text-left hover:text-[#2dd4bf] transition-colors"
              >
                <p className="text-sm text-white">
                  <span className="font-black text-[#b79753]">{notification.playerName}</span>: el precio{' '}
                  {CONDITION_LABEL[notification.condition]}{' '}
                  <span className="font-bold text-[#b79753]">{notification.triggeredValue}</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
