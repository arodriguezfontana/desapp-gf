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
        return 'bg-[#ff6b00]/20 text-[#ff6b00] border-[#ff6b00]/40';
      case 'DF':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'MF':
        return 'bg-[#10b981]/20 text-[#34d399] border-[#10b981]/40';
      case 'FW':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  return (
    <div className="bg-[#0d2b1e] rounded-2xl shadow-xl hover:shadow-2xl border border-[#123828] hover:border-[#ff6b00]/50 transition-all overflow-hidden flex flex-col justify-between group">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span
            className={`text-xs font-black px-2.5 py-1 rounded-md border ${getPositionBadgeColor(
              player.position,
            )}`}
          >
            {player.position}
          </span>
          <span className="text-[11px] font-extrabold text-[#34d399] bg-[#071a12] px-2.5 py-1 rounded-md border border-[#10b981]/30">
            {player.league}
          </span>
        </div>

        <h3 className="text-lg font-black text-white group-hover:text-[#ff6b00] transition-colors line-clamp-1 tracking-tight">
          {player.name}
        </h3>

        <p className="text-xs font-bold text-gray-300 mt-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00]"></span>
          {player.team}
        </p>
      </div>

      <div className="bg-[#071a12] px-5 py-3 border-t border-[#123828] flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Ficha técnica
        </span>
        <Link
          to={`/catalog/${player.id}`}
          className="text-xs font-black text-[#ff6b00] group-hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider"
        >
          Ver detalle &rarr;
        </Link>
      </div>
    </div>
  );
};
