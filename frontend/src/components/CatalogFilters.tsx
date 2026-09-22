import React from 'react';
import { LEAGUES, POSITIONS } from '../types/catalog.types';
import type { League, Position } from '../types/catalog.types';

interface CatalogFiltersProps {
  selectedLeague: string;
  selectedPosition: string;
  teamInput: string;
  onLeagueChange: (league: string) => void;
  onPositionChange: (position: string) => void;
  onTeamInputChange: (team: string) => void;
  onClearFilters: () => void;
}

export const CatalogFilters: React.FC<CatalogFiltersProps> = ({
  selectedLeague,
  selectedPosition,
  teamInput,
  onLeagueChange,
  onPositionChange,
  onTeamInputChange,
  onClearFilters,
}) => {
  const hasActiveFilters = Boolean(selectedLeague || selectedPosition || teamInput);

  return (
    <div className="bg-[#0d2b1e] rounded-2xl shadow-2xl border border-[#123828] p-5 md:p-6 mb-8 transition-all">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b00] inline-block animate-pulse"></span>
            Filtros de Búsqueda de Mercado
          </h2>
          <p className="text-xs font-medium text-gray-300 mt-0.5">
            Explorá los futbolistas por competencia, demarcación o equipo
          </p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-bold text-[#ff6b00] hover:text-white bg-[#071a12] hover:bg-[#ff6b00] px-3.5 py-2 rounded-xl border border-[#ff6b00]/40 transition-all self-start md:self-auto cursor-pointer shadow-sm"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selector de Liga */}
        <div>
          <label htmlFor="league-filter" className="block text-xs font-black uppercase tracking-widest text-[#ff6b00] mb-1.5">
            Liga / Competencia
          </label>
          <select
            id="league-filter"
            value={selectedLeague}
            onChange={(e) => onLeagueChange(e.target.value)}
            className="w-full bg-[#071a12] border border-[#123828] rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 cursor-pointer transition-all"
          >
            <option value="" className="bg-[#071a12] text-white">Todas las ligas</option>
            {LEAGUES.map((league: League) => (
              <option key={league} value={league} className="bg-[#071a12] text-white">
                {league}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Posición */}
        <div>
          <label htmlFor="position-filter" className="block text-xs font-black uppercase tracking-widest text-[#ff6b00] mb-1.5">
            Posición en cancha
          </label>
          <select
            id="position-filter"
            value={selectedPosition}
            onChange={(e) => onPositionChange(e.target.value)}
            className="w-full bg-[#071a12] border border-[#123828] rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 cursor-pointer transition-all"
          >
            <option value="" className="bg-[#071a12] text-white">Todas las posiciones</option>
            {POSITIONS.map((pos: Position) => (
              <option key={pos} value={pos} className="bg-[#071a12] text-white">
                {pos === 'GK' ? 'Arquero (GK)' : pos === 'DF' ? 'Defensor (DF)' : pos === 'MF' ? 'Mediocampista (MF)' : 'Delantero (FW)'}
              </option>
            ))}
          </select>
        </div>

        {/* Búsqueda por Equipo libre */}
        <div>
          <label htmlFor="team-filter" className="block text-xs font-black uppercase tracking-widest text-[#ff6b00] mb-1.5">
            Equipo / Club
          </label>
          <input
            id="team-filter"
            type="text"
            value={teamInput}
            onChange={(e) => onTeamInputChange(e.target.value)}
            placeholder="Ej. Boca Juniors, Real Madrid..."
            className="w-full bg-[#071a12] border border-[#123828] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 font-medium focus:outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 transition-all"
          />
        </div>
      </div>
    </div>
  );
};
