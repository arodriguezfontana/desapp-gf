import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../hooks/useCatalog';
import { useRanking } from '../hooks/useRanking';
import { useApiKey } from '../hooks/useApiKey';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { CatalogFilters } from '../components/CatalogFilters';
import { PaginationControls } from '../components/PaginationControls';
import { PlayerCard } from '../components/PlayerCard';
import type { Player, PlayerListResponseDto, RankedPlayer } from '../types/catalog.types';
import type { PlayerValuationResponseDto } from '../types/userStrategy.types';
import { getPositionLabel } from '../types/catalog.types';

type CatalogTab = 'catalog' | 'ranking';

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-black">🥇</span>;
  if (rank === 2) return <span className="text-gray-300 font-black">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-black">🥉</span>;
  return <span className="text-gray-400 font-black text-sm">#{rank}</span>;
}

export const CatalogPage: React.FC = () => {
  const { hasApiKey } = useApiKey();
  const { isAuthenticated } = useAuth();
  const { getPlayers, getMyValuationByPlayerId } = useCatalog();
  const { getRanking } = useRanking();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') ?? 'catalog') as CatalogTab;
  const selectedLeague = searchParams.get('league') ?? '';
  const selectedPosition = searchParams.get('position') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1');
  const urlTeam = searchParams.get('team') ?? '';

  // Local state for the text input only (keeps typing responsive)
  const [teamInput, setTeamInput] = useState(urlTeam);
  const debouncedTeam = useDebounce(teamInput, 400);

  // Sync debounced team value to URL (skip when already in sync to avoid loops)
  useEffect(() => {
    if (debouncedTeam === urlTeam) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedTeam) next.set('team', debouncedTeam);
      else next.delete('team');
      next.set('page', '1');
      return next;
    }, { replace: true });
  }, [debouncedTeam, urlTeam, setSearchParams]);

  const setPage = useCallback((p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // --- Catalog state ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [quotes, setQuotes] = useState<Map<string, PlayerValuationResponseDto>>(new Map());
  const [meta, setMeta] = useState<PlayerListResponseDto['meta']>({ total: 0, page: 1, pageSize: 12, totalPages: 1 });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // --- Ranking state ---
  const [rankedPlayers, setRankedPlayers] = useState<RankedPlayer[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [rankingTotalPages, setRankingTotalPages] = useState(1);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  // Catalog fetch
  useEffect(() => {
    if (activeTab !== 'catalog' || !hasApiKey) return;
    let cancelled = false;

    const run = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      setQuotes(new Map());
      try {
        const response = await getPlayers({ page: currentPage, pageSize: 12, league: selectedLeague, position: selectedPosition, team: debouncedTeam });
        if (cancelled) return;
        const loaded = response.data ?? [];
        setPlayers(loaded);
        if (response.meta) setMeta(response.meta);
        void Promise.all(loaded.map((p) => getMyValuationByPlayerId(p.id))).then((results) => {
          if (cancelled) return;
          const map = new Map<string, PlayerValuationResponseDto>();
          loaded.forEach((p, i) => { const q = results[i]; if (q) map.set(p.id, q); });
          setQuotes(map);
        });
      } catch (err) {
        if (!cancelled && err instanceof Error && err.message !== 'ApiKey no válida o expirada.') {
          setCatalogError('Ocurrió un inconveniente al cargar el catálogo. Verificá tu conexión.');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    run().catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeTab, hasApiKey, currentPage, selectedLeague, selectedPosition, debouncedTeam, getPlayers, getMyValuationByPlayerId]);

  // Ranking fetch
  useEffect(() => {
    if (activeTab !== 'ranking' || !isAuthenticated) return;
    let cancelled = false;

    const run = async () => {
      setRankingLoading(true);
      setRankingError(null);
      try {
        const res = await getRanking({ page: currentPage, pageSize: 10, league: selectedLeague, position: selectedPosition, team: debouncedTeam });
        if (cancelled) return;
        setRankedPlayers(res.items);
        setRankingTotal(res.total);
        setRankingTotalPages(Math.max(1, Math.ceil(res.total / (res.pageSize || 10))));
      } catch {
        if (!cancelled) setRankingError('Ocurrió un inconveniente al cargar el ranking. Verificá tu conexión.');
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    };

    run().catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeTab, isAuthenticated, currentPage, selectedLeague, selectedPosition, debouncedTeam, getRanking]);

  const handleLeagueChange = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v) next.set('league', v); else next.delete('league');
      next.set('page', '1');
      return next;
    }, { replace: true });
  };
  const handlePositionChange = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v) next.set('position', v); else next.delete('position');
      next.set('page', '1');
      return next;
    }, { replace: true });
  };
  const handleTeamInputChange = (v: string) => { setTeamInput(v); };
  const handleClearFilters = () => {
    setTeamInput('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('league');
      next.delete('position');
      next.delete('team');
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  const handleTabChange = (tab: CatalogTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  // --- No ApiKey guard (full page) ---
  if (!hasApiKey) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="bg-[#104443] border border-[#b79753]/40 rounded-2xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753] text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-inner">
            🔑
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white mb-3">Clave de Acceso Requerida</h2>
          <p className="text-sm sm:text-base text-gray-300 font-medium mb-8 max-w-md mx-auto">Necesitás generar una ApiKey para ver el catálogo.</p>
          <Link to="/account" className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl cursor-pointer text-xs sm:text-sm">
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // --- Catalog content ---
  let catalogContent: React.ReactNode;
  if (catalogLoading) {
    catalogContent = (
      <div className="text-center py-20 bg-[#104443] rounded-2xl border border-[#1a6866] shadow-xl">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4" />
        <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando futbolistas del catálogo...</p>
      </div>
    );
  } else if (catalogError) {
    catalogContent = (
      <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wider">{catalogError}</p>
      </div>
    );
  } else if (players.length === 0) {
    catalogContent = (
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-12 text-center shadow-xl">
        <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753]/40 text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
        <h3 className="text-lg font-black uppercase tracking-wider text-white mb-1">Sin resultados</h3>
        <p className="text-base font-semibold text-gray-300">No se encontraron jugadores con estos filtros.</p>
        {(selectedLeague || selectedPosition || teamInput) && (
          <button type="button" onClick={handleClearFilters} className="mt-5 text-xs font-black uppercase tracking-wider text-[#b79753] hover:text-white bg-[#0b3332] px-4 py-2.5 rounded-xl border border-[#b79753]/40 transition-colors cursor-pointer">
            Restablecer filtros de búsqueda
          </button>
        )}
      </div>
    );
  } else {
    catalogContent = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} quote={quotes.get(player.id) ?? null} />
          ))}
        </div>
        <PaginationControls currentPage={currentPage} totalPages={meta.totalPages} totalItems={meta.total} pageSize={meta.pageSize} isLoading={catalogLoading} onPageChange={setPage} />
      </>
    );
  }

  // --- Ranking content ---
  let rankingContent: React.ReactNode;
  if (!isAuthenticated) {
    rankingContent = (
      <div className="bg-[#104443] border border-[#b79753]/40 rounded-2xl p-10 text-center shadow-xl">
        <div className="w-14 h-14 bg-[#0b3332] border border-[#b79753] text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
        <h3 className="text-lg font-black uppercase tracking-wider text-white mb-2">Sesión Requerida</h3>
        <p className="text-sm text-gray-300 font-medium mb-6">Iniciá sesión para ver el ranking según tus estrategias de valuación.</p>
        <Link to="/login" className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-xl cursor-pointer text-xs">
          Iniciar sesión &rarr;
        </Link>
      </div>
    );
  } else if (rankingLoading) {
    rankingContent = (
      <div className="text-center py-20 bg-[#104443] rounded-2xl border border-[#1a6866] shadow-xl">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4" />
        <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando ranking...</p>
      </div>
    );
  } else if (rankingError) {
    rankingContent = (
      <div className="bg-[#f43f5e]/10 border border-[#f43f5e] text-white p-6 rounded-2xl text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wider">{rankingError}</p>
      </div>
    );
  } else if (rankedPlayers.length === 0) {
    rankingContent = (
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl p-12 text-center shadow-xl">
        <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753]/40 text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
        <h3 className="text-lg font-black uppercase tracking-wider text-white mb-1">Sin resultados</h3>
        <p className="text-base font-semibold text-gray-300">No hay jugadores cotizados con estos filtros.</p>
        {(selectedLeague || selectedPosition || teamInput) && (
          <button type="button" onClick={handleClearFilters} className="mt-5 text-xs font-black uppercase tracking-wider text-[#b79753] hover:text-white bg-[#0b3332] px-4 py-2.5 rounded-xl border border-[#b79753]/40 transition-colors cursor-pointer">
            Restablecer filtros
          </button>
        )}
      </div>
    );
  } else {
    rankingContent = (
      <>
        <div className="overflow-x-auto rounded-2xl border border-[#1a6866] shadow-xl">
          <table className="w-full text-sm text-white">
            <thead className="bg-[#104443] border-b border-[#1a6866]">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#b79753]">Pos.</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#b79753]">Jugador</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#b79753] hidden sm:table-cell">Posición</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#b79753] hidden md:table-cell">Liga</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#b79753] hidden md:table-cell">Equipo</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#b79753]">Valor</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#b79753] hidden sm:table-cell">Score</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#b79753] hidden lg:table-cell">Estrategia</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((p, i) => (
                <tr key={p.id} className={`border-b border-[#1a6866]/60 transition-colors hover:bg-[#1a6866]/30 ${i % 2 === 0 ? 'bg-[#0b3332]' : 'bg-[#104443]/50'}`}>
                  <td className="px-4 py-3 text-center w-12"><MedalIcon rank={p.rank} /></td>
                  <td className="px-4 py-3"><Link to={`/catalog/${p.id}`} className="font-bold text-white hover:text-[#b79753] transition-colors">{p.name}</Link></td>
                  <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{getPositionLabel(p.position)}</td>
                  <td className="px-4 py-3 text-gray-300 hidden md:table-cell">{p.league}</td>
                  <td className="px-4 py-3 text-gray-300 hidden md:table-cell">{p.team}</td>
                  <td className="px-4 py-3 text-right font-black text-[#b79753]">${p.valor.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">{p.score.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{p.strategyName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls currentPage={currentPage} totalPages={rankingTotalPages} totalItems={rankingTotal} pageSize={10} isLoading={rankingLoading} onPageChange={setPage} />
      </>
    );
  }

  return (
    <div className="w-full animate-fade-in space-y-8 pb-12">
      <title>Catálogo — FútVal</title>

      <section className="relative w-full bg-[#0b3332] border-b border-[#1a6866] pt-8 pb-10 overflow-hidden group">
        <div className="absolute inset-0 z-0">
          <img src="/assets/stadium_hero.jpg" alt="Estadio de fútbol" className="w-full h-full object-cover filter brightness-45 contrast-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b3332] via-[#0b3332]/85 to-[#0b3332]/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b3332]/95 via-[#0b3332]/70 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332]/90 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#b79753]/30 inline-block mb-2">
                MERCADO DE FICHAJES
              </span>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-wider text-white">
                {activeTab === 'catalog' ? 'Catálogo de Jugadores' : 'Ranking de Jugadores'}
              </h1>
              <p className="text-gray-200 text-xs sm:text-sm mt-1 max-w-xl font-medium drop-shadow">
                {activeTab === 'catalog'
                  ? 'Explorá el catálogo de futbolistas, filtrá por competencia, posición y equipo en tiempo real.'
                  : 'Jugadores ordenados por valor de cotización vigente, según tu estrategia de valuación.'}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-[#0b3332]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#b79753]/30 shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-[#b79753] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {activeTab === 'catalog' ? `${meta.total} Jugadores` : `${rankingTotal} Cotizados`}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('catalog')}
              className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all border cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#b79753] text-[#0b3332] border-[#b79753] shadow-md'
                  : 'bg-[#0b3332]/80 text-gray-300 border-[#1a6866] hover:text-white hover:border-gray-400'
              }`}
            >
              📋 Catálogo
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('ranking')}
              className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all border cursor-pointer ${
                activeTab === 'ranking'
                  ? 'bg-[#b79753] text-[#0b3332] border-[#b79753] shadow-md'
                  : 'bg-[#0b3332]/80 text-gray-300 border-[#1a6866] hover:text-white hover:border-gray-400'
              }`}
            >
              🏆 Ranking
            </button>
          </div>

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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {activeTab === 'catalog' ? catalogContent : rankingContent}
      </section>
    </div>
  );
};
