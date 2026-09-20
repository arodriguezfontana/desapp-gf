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

    // Usar microtarea/promise para evitar set-state síncrono al montar el efecto
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
        <div className="bg-amber-50 border-2 border-amber-400/50 rounded-2xl p-8 text-center shadow-md">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🔑
          </div>
          <h2 className="text-2xl font-extrabold text-emerald-950 mb-3">
            Clave de Acceso Requerida
          </h2>
          <p className="text-base text-gray-700 font-medium mb-6">
            Necesitás generar una ApiKey para ver el catálogo.
          </p>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Banner de título */}
      <div className="mb-8 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-emerald-900/80 px-3 py-1 rounded-full border border-amber-400/30">
            Mercado Deportivo
          </span>
          <h1 className="text-3xl sm:text-4xl font-black mt-2 tracking-tight">
            Catálogo de Jugadores
          </h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-xl">
            Explorá las 5 ligas principales de Europa y consultá la posición de tus futbolistas preferidos.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-emerald-900/60 px-4 py-2.5 rounded-xl border border-emerald-700/50">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-bold text-emerald-100">
            {meta.total} Jugadores Registrados
          </span>
        </div>
      </div>

      {/* Filtros */}
      <CatalogFilters
        selectedLeague={selectedLeague}
        selectedPosition={selectedPosition}
        teamInput={teamInput}
        onLeagueChange={handleLeagueChange}
        onPositionChange={handlePositionChange}
        onTeamInputChange={handleTeamInputChange}
        onClearFilters={handleClearFilters}
      />

      {/* Contenido principal: Carga, Error general o Grilla de Jugadores */}
      {isLoading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-emerald-900/10 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-emerald-900 border-t-amber-500 mb-4"></div>
          <p className="text-sm font-semibold text-emerald-900">Cargando jugadores del catálogo...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl text-center shadow-sm">
          <p className="text-sm font-semibold">{errorMsg}</p>
        </div>
      ) : players.length === 0 ? (
        <div className="bg-white border border-emerald-900/10 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🔍
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Sin resultados
          </h3>
          <p className="text-base font-semibold text-emerald-900">
            No se encontraron jugadores con estos filtros.
          </p>
          {(selectedLeague || selectedPosition || teamInput) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 transition-colors cursor-pointer"
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

