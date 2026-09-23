import React from 'react';
import { Link } from 'react-router-dom';
import type { Player } from '../types/catalog.types';

interface PlayerCardProps {
  player: Player;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
  const getPositionBadgeColor = (pos: string) => {
    switch (pos) {
      case 'GK':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'DF':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'MF':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'FW':
        return 'bg-orange-100 text-orange-900 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md border border-emerald-900/10 transition-all overflow-hidden flex flex-col justify-between group">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getPositionBadgeColor(
              player.position,
            )}`}
          >
            {player.position}
          </span>
          <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            {player.league}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-900 transition-colors line-clamp-1">
          {player.name}
        </h3>

        <p className="text-sm font-semibold text-amber-600 mt-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {player.team}
        </p>
      </div>

      <div className="bg-emerald-50/60 px-5 py-3 border-t border-emerald-900/5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Ficha técnica</span>
        <Link
          to={`/catalog/${player.id}`}
          className="text-xs font-bold text-emerald-900 group-hover:text-amber-600 flex items-center gap-1 transition-colors"
        >
          Ver detalle &rarr;
        </Link>
      </div>
    </div>
  );
};

