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
        return 'bg-[#b79753]/20 text-[#b79753] border-[#b79753]/40';
      case 'DF':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'MF':
        return 'bg-[#2dd4bf]/20 text-[#2dd4bf] border-[#2dd4bf]/40';
      case 'FW':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="bg-[#104443] rounded-2xl shadow-xl hover:shadow-2xl border border-[#1a6866] hover:border-[#b79753]/60 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden flex flex-col justify-between group relative">
      {/* Top Accent Gold Bar on Hover */}
      <div className="h-1 w-full bg-[#b79753] opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 inset-x-0" />

      <div className="p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <span
            className={`text-[11px] font-black tracking-widest px-3 py-1 rounded-lg border uppercase ${getPositionBadgeColor(
              player.position,
            )}`}
          >
            {player.position}
          </span>
          <span className="text-[10px] font-extrabold text-[#b79753] bg-[#0b3332] px-2.5 py-1 rounded-md border border-[#b79753]/30 uppercase">
            {player.league}
          </span>
        </div>

        {/* Player Avatar & Details Header */}
        <div className="flex items-center gap-4 my-2">
          <div className="w-12 h-12 rounded-full bg-[#0b3332] border-2 border-[#b79753]/40 text-[#b79753] flex items-center justify-center font-black text-lg shadow-inner group-hover:border-[#b79753] group-hover:scale-105 transition-all">
            ⚽
          </div>
          <div className="overflow-hidden">
            <h3 className="text-lg font-black text-white group-hover:text-[#b79753] transition-colors line-clamp-1 tracking-tight">
              {player.name}
            </h3>
            <p className="text-xs font-bold text-gray-300 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b79753]"></span>
              <span className="truncate">{player.team}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="bg-[#0b3332] px-6 py-3.5 border-t border-[#1a6866] flex items-center justify-between group-hover:border-[#b79753]/30 transition-colors">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
          FICHA TÉCNICA
        </span>
        <Link
          to={`/catalog/${player.id}`}
          className="text-xs font-black text-[#b79753] group-hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider"
        >
          Ver detalle &rarr;
        </Link>
      </div>
    </div>
  );
};
