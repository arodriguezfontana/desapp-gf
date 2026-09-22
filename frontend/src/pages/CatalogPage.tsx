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
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-[#0d2b1e] border-2 border-[#ff6b00]/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#071a12] border border-[#ff6b00] text-[#ff6b00] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🔑
          </div>
          <h2 className="text-2xl font-black uppercase tracking-wider text-white mb-3">
            Clave de Acceso Requerida
          </h2>
          <p className="text-base text-gray-300 font-medium mb-6">
            Necesitás generar una ApiKey para ver el catálogo.
          </p>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05e00] text-white font-black uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-xl hover:shadow-[#ff6b00]/40 cursor-pointer"
          >
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Banner de Título Mercado */}
      <div className="bg-gradient-to-r from-[#0d2b1e] via-[#123828] to-[#0d2b1e] text-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-[#ff6b00]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00] bg-[#071a12] px-3 py-1 rounded-md border border-[#ff6b00]/30">
            FÚTBOL EUROPEO (5 LIGAS PRINCIPALES)
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider mt-2.5">
            Catálogo de Jugadores
          </h1>
          <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-xl font-medium">
            Explorá el mercado completo de futbolistas, filtrá por liga, equipo y posición, y consultá sus fichas técnicas.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[#071a12] px-4 py-2.5 rounded-xl border border-[#10b981]/30">
          <div className="w-3 h-3 rounded-full bg-[#10b981] animate-pulse" />
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
        <div className="text-center py-16 bg-[#0d2b1e] rounded-2xl border border-[#123828] shadow-2xl">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#10b981] border-t-[#ff6b00] mb-4"></div>
          <p className="text-xs font-black uppercase tracking-wider text-[#34d399]">Cargando jugadores del catálogo...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-[#ea580c]/10 border border-[#ea580c] text-white p-6 rounded-2xl text-center shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wider">{errorMsg}</p>
        </div>
      ) : players.length === 0 ? (
        <div className="bg-[#0d2b1e] border border-[#123828] rounded-2xl p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#071a12] border border-[#ff6b00]/40 text-[#ff6b00] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
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
              className="mt-5 text-xs font-black uppercase tracking-wider text-[#ff6b00] hover:text-white bg-[#071a12] px-4 py-2.5 rounded-xl border border-[#ff6b00]/40 transition-colors cursor-pointer"
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
