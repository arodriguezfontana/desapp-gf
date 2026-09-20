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
    <div className="bg-white rounded-xl shadow-sm border border-emerald-900/10 p-4 md:p-6 mb-8 transition-all">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-emerald-950 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            Filtros de Búsqueda
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Explorá los futbolistas por competencia, demarcación o equipo
          </p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors self-start md:self-auto cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selector de Liga */}
        <div>
          <label htmlFor="league-filter" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Liga / Competencia
          </label>
          <select
            id="league-filter"
            value={selectedLeague}
            onChange={(e) => onLeagueChange(e.target.value)}
            className="w-full bg-emerald-50/50 border border-emerald-900/20 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent cursor-pointer transition-all"
          >
            <option value="">Todas las ligas</option>
            {LEAGUES.map((league: League) => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Posición */}
        <div>
          <label htmlFor="position-filter" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Posición en cancha
          </label>
          <select
            id="position-filter"
            value={selectedPosition}
            onChange={(e) => onPositionChange(e.target.value)}
            className="w-full bg-emerald-50/50 border border-emerald-900/20 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent cursor-pointer transition-all"
          >
            <option value="">Todas las posiciones</option>
            {POSITIONS.map((pos: Position) => (
              <option key={pos} value={pos}>
                {pos === 'GK' ? 'Arquero (GK)' : pos === 'DF' ? 'Defensor (DF)' : pos === 'MF' ? 'Mediocampista (MF)' : 'Delantero (FW)'}
              </option>
            ))}
          </select>
        </div>

        {/* Búsqueda por Equipo libre */}
        <div>
          <label htmlFor="team-filter" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Equipo / Club
          </label>
          <input
            id="team-filter"
            type="text"
            value={teamInput}
            onChange={(e) => onTeamInputChange(e.target.value)}
            placeholder="Ej. Boca Juniors, Real Madrid..."
            className="w-full bg-emerald-50/50 border border-emerald-900/20 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
          />
        </div>
      </div>
    </div>
  );
};

