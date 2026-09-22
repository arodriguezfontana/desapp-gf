import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { catalogService } from '../service/catalogService';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { httpEvents } from '../service/httpClient';
import { useDebounce } from '../hooks/useDebounce';
import { CatalogFilters } from '../components/CatalogFilters';
import { PaginationControls } from '../components/PaginationControls';
import { PlayerCard } from '../components/PlayerCard';
import type { Player, PlayerListResponseDto } from '../types/catalog.types';

export const CatalogPage: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => Boolean(apiKeyStorage.getApiKey()));
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [teamInput, setTeamInput] = useState<string>('');
  const debouncedTeam = useDebounce(teamInput, 400);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [meta, setMeta] = useState<PlayerListResponseDto['meta']>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Escuchar evento de ApiKey no válida (401)
  useEffect(() => {
    const handleUnauthorizedKey = () => {
      setHasApiKey(false);
    };

    httpEvents.addEventListener('apiKeyUnauthorized', handleUnauthorizedKey);
    return () => {
      httpEvents.removeEventListener('apiKeyUnauthorized', handleUnauthorizedKey);
    };
  }, []);

  // Recargar al cambiar filtros o página
  useEffect(() => {
    if (!hasApiKey) return;
    let isCancelled = false;

    const executeFetch = async () => {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const response = await catalogService.getPlayers({
          page: currentPage,
          league: selectedLeague,
          position: selectedPosition,
          team: debouncedTeam,
        });

        if (!isCancelled) {
          setPlayers(response.data ?? []);
          if (response.meta) {
            setMeta(response.meta);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          if (err instanceof Error && err.message !== 'ApiKey no válida o expirada.') {
            setErrorMsg('Ocurrió un inconveniente al cargar el catálogo. Verificá tu conexión.');
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    Promise.resolve().then(() => {
      if (!isCancelled) {
        void executeFetch();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [hasApiKey, currentPage, selectedLeague, selectedPosition, debouncedTeam]);

  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
    setCurrentPage(1);
  };

  const handlePositionChange = (position: string) => {
    setSelectedPosition(position);
    setCurrentPage(1);
  };

  const handleTeamInputChange = (team: string) => {
    setTeamInput(team);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedLeague('');
    setSelectedPosition('');
    setTeamInput('');
    setCurrentPage(1);
  };

  if (!hasApiKey) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="bg-[#104443] border border-[#d4af37]/40 rounded-2xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#d4af37] text-[#d4af37] rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-inner">
            🔑
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white mb-3">
            Clave de Acceso Requerida
          </h2>
          <p className="text-sm sm:text-base text-gray-300 font-medium mb-8 max-w-md mx-auto">
            Necesitás generar una ApiKey para ver el catálogo.
          </p>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 bg-[#d4af37] hover:bg-[#b89528] text-[#0b3332] font-black uppercase tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl hover:shadow-[#d4af37]/40 cursor-pointer text-xs sm:text-sm"
          >
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Banner de Título Mercado */}
      <div className="bg-[#104443] text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-[#1a6866] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] bg-[#0b3332] px-3.5 py-1 rounded-full border border-[#d4af37]/30 inline-block mb-2">
            MERCADO DE JUGADORES
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white">
            Catálogo de Futbolistas
          </h1>
          <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-xl font-medium">
            Explorá el mercado completo de futbolistas, filtrá por liga, equipo y posición, y consultá sus fichas técnicas.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[#0b3332] px-4 py-2.5 rounded-xl border border-[#d4af37]/30">
          <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            {meta.total} Jugadores Registrados
          </span>
        </div>
      </div>

      {/* Componente de Filtros */}
      <CatalogFilters
        selectedLeague={selectedLeague}
        selectedPosition={selectedPosition}
        teamInput={teamInput}
        onLeagueChange={handleLeagueChange}
        onPositionChange={handlePositionChange}
        onTeamInputChange={handleTeamInputChange}
        onClearFilters={handleClearFilters}
      />

      {/* Contenido Principal: Carga, Error o Lista */}
      {isLoading ? (
        <div className="text-center py-16 bg-[#104443] rounded-2xl border border-[#1a6866] shadow-xl">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#d4af37] mb-4"></div>
          <p className="text-xs font-black uppercase tracking-wider text-[#d4af37]">Cargando futbolistas del catálogo...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider">{errorMsg}</p>
        </div>
      ) : players.length === 0 ? (
        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-12 text-center shadow-xl">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#d4af37]/40 text-[#d4af37] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🔍
          </div>
          <h3 className="text-lg font-black uppercase tracking-wider text-white mb-1">
            Sin resultados
          </h3>
          <p className="text-base font-semibold text-gray-300">
            No se encontraron jugadores con estos filtros.
          </p>
          {(selectedLeague || selectedPosition || teamInput) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-5 text-xs font-black uppercase tracking-wider text-[#d4af37] hover:text-white bg-[#0b3332] px-4 py-2.5 rounded-xl border border-[#d4af37]/40 transition-colors cursor-pointer"
            >
              Restablecer filtros de búsqueda
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {players.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            pageSize={meta.pageSize}
            isLoading={isLoading}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </>
      )}
    </div>
  );
};
