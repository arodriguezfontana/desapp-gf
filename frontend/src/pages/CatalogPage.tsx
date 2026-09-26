import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../hooks/useCatalog';
import { useApiKey } from '../hooks/useApiKey';
import { useDebounce } from '../hooks/useDebounce';
import { CatalogFilters } from '../components/CatalogFilters';
import { PaginationControls } from '../components/PaginationControls';
import { PlayerCard } from '../components/PlayerCard';
import type { Player, PlayerListResponseDto } from '../types/catalog.types';

export const CatalogPage: React.FC = () => {
  const { hasApiKey } = useApiKey();
  const { getPlayers } = useCatalog();
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [teamInput, setTeamInput] = useState<string>('');
  const debouncedTeam = useDebounce(teamInput, 400);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [meta, setMeta] = useState<PlayerListResponseDto['meta']>({
    total: 0,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recargar al cambiar filtros o página (con 12 por página)
  useEffect(() => {
    if (!hasApiKey) return;
    let isCancelled = false;

    const executeFetch = async () => {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const response = await getPlayers({
          page: currentPage,
          pageSize: 12,
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
  }, [hasApiKey, currentPage, selectedLeague, selectedPosition, debouncedTeam, getPlayers]);

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
        <div className="bg-[#104443] border border-[#b79753]/40 rounded-2xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753] text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-inner">
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
            className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl hover:shadow-[#b79753]/40 cursor-pointer text-xs sm:text-sm"
          >
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in space-y-8 pb-12">
      <title>Catálogo — FútVal</title>

      {/* CATALOG HERO SECTION COMBINED WITH FILTERS (EDGE-TO-EDGE HERO STYLE) */}
      <section className="relative w-full bg-[#0b3332] border-b border-[#1a6866] pt-8 pb-10 overflow-hidden group">
        {/* Full Bleed Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/stadium_hero.jpg"
            alt="Estadio de fútbol"
            className="w-full h-full object-cover filter brightness-45 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b3332] via-[#0b3332]/85 to-[#0b3332]/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b3332]/95 via-[#0b3332]/70 to-transparent" />
        </div>

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332]/90 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#b79753]/30 inline-block mb-2">
                FÚTVAL — MERCADO DE FICHAJES
              </span>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-wider text-white">
                Catálogo de Jugadores
              </h1>
              <p className="text-gray-200 text-xs sm:text-sm mt-1 max-w-xl font-medium drop-shadow">
                Explorá el catálogo de futbolistas, filtrá por competencia, posición y equipo en tiempo real.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-[#0b3332]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#b79753]/30 shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-[#b79753] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {meta.total} Jugadores Registrados
              </span>
            </div>
          </div>

          {/* Integrated Catalog Filters Component inside Hero */}
          <div className="pt-2">
            <CatalogFilters
              selectedLeague={selectedLeague}
              selectedPosition={selectedPosition}
              teamInput={teamInput}
              onLeagueChange={handleLeagueChange}
              onPositionChange={handlePositionChange}
              onTeamInputChange={handleTeamInputChange}
              onClearFilters={handleClearFilters}
            />
          </div>
        </div>
      </section>

      {/* MAIN CATALOG GRID SECTION (12 ITEMS PER PAGE) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-20 bg-[#104443] rounded-2xl border border-[#1a6866] shadow-xl">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4"></div>
            <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando futbolistas del catálogo...</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wider">{errorMsg}</p>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-12 text-center shadow-xl">
            <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753]/40 text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
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
                className="mt-5 text-xs font-black uppercase tracking-wider text-[#b79753] hover:text-white bg-[#0b3332] px-4 py-2.5 rounded-xl border border-[#b79753]/40 transition-colors cursor-pointer"
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
      </section>
    </div>
  );
};
