import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAdmin } from '../hooks/useAdmin';
import { useApiKey } from '../hooks/useApiKey';
import { useAuthActions } from '../hooks/useAuthActions';
import type {
  SyncRunStatusDto,
  SyncSummaryDto,
  RecalculateResponseDto,
  StrategyResponseDto,
} from '../types/admin.types';

function getWhoScoredBadgeClassName(status: SyncRunStatusDto['status'] | undefined): string {
  if (status === 'running') {
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse';
  }
  if (status === 'completed') {
    return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
  }
  return 'bg-rose-500/20 text-rose-400 border border-rose-500/40';
}

const StrategiesList: React.FC<{
  isLoading: boolean;
  strategies: StrategyResponseDto[];
  activatingStrategyId: string | null;
  onActivate: (strategyId: string) => void;
}> = ({ isLoading, strategies, activatingStrategyId, onActivate }) => {
  if (isLoading) {
    return <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cargando estrategias...</p>;
  }

  if (strategies.length === 0) {
    return (
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        No hay estrategias configuradas todavía.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {strategies.map((strategy) => (
        <div
          key={strategy.id}
          className={`rounded-xl p-4 border space-y-3 ${
            strategy.isActive
              ? 'bg-[#0b3332] border-[#2dd4bf]/60'
              : 'bg-[#0b3332]/50 border-[#1a6866]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">{strategy.name}</h3>
            {strategy.isActive && (
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded">
                Activa
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {Object.entries(strategy.weights).map(([metric, weight]) => (
              <span
                key={metric}
                className="text-[9px] font-bold px-2 py-0.5 bg-[#104443] text-gray-200 rounded border border-white/10"
              >
                {metric}: {weight}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium">
              Factor de escala: <span className="text-[#b79753] font-bold">{strategy.factorEscala}</span>
            </span>
          </div>

          {!strategy.isActive && (
            <button
              onClick={() => onActivate(strategy.id)}
              disabled={activatingStrategyId !== null}
              className="w-full py-2 bg-[#b79753] hover:bg-[#9e8144] disabled:opacity-50 text-[#0b3332] font-black uppercase text-[10px] tracking-widest transition-all rounded-lg shadow-md active:scale-95 cursor-pointer"
            >
              {activatingStrategyId === strategy.id ? 'Activando...' : 'Activar esta estrategia'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const { user, isAdmin, isLoading: isUserLoading } = useCurrentUser();
  const {
    triggerWhoScoredSync,
    getWhoScoredRunStatus,
    triggerFootballDataSync,
    recalculateQuotes,
    listStrategies,
    activateStrategy,
  } = useAdmin();
  const { hasApiKey, saveApiKey } = useApiKey();
  const { generateApiKey } = useAuthActions();

  // Estados de WhoScored
  const [whoScoredRunId, setWhoScoredRunId] = useState<string | null>(null);
  const [whoScoredStatus, setWhoScoredStatus] = useState<SyncRunStatusDto | null>(null);
  const [isWhoScoredTriggering, setIsWhoScoredTriggering] = useState<boolean>(false);
  const [whoScoredError, setWhoScoredError] = useState<string | null>(null);

  // Estados de Football-Data
  const [isFootballDataSyncing, setIsFootballDataSyncing] = useState<boolean>(false);
  const [footballDataResult, setFootballDataResult] = useState<SyncSummaryDto | null>(null);
  const [footballDataError, setFootballDataError] = useState<string | null>(null);

  // Estados de Recalculate Quotes
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalculateResult, setRecalculateResult] = useState<RecalculateResponseDto | null>(null);
  const [recalculateError, setRecalculateError] = useState<string | null>(null);

  // Generación de clave de acceso
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);
  const [keySuccessMsg, setKeySuccessMsg] = useState<string | null>(null);

  // Estados de Estrategias de Valuación
  const [strategies, setStrategies] = useState<StrategyResponseDto[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState<boolean>(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  const [activatingStrategyId, setActivatingStrategyId] = useState<string | null>(null);

  // Polling para WhoScored cuando está en estado "running"
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!whoScoredRunId || whoScoredStatus?.status === 'completed' || whoScoredStatus?.status === 'failed') {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const poll = async () => {
      try {
        const status = await getWhoScoredRunStatus(whoScoredRunId);
        setWhoScoredStatus(status);
        if (status.status === 'completed' || status.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Ignorar fallos transitorios en el sondeo
      }
    };

    pollingRef.current = window.setInterval(poll, 3500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [whoScoredRunId, whoScoredStatus?.status, getWhoScoredRunStatus]);

  // Carga la lista de estrategias en cuanto hay clave de acceso disponible
  useEffect(() => {
    let cancelled = false;

    const loadStrategies = async () => {
      if (!hasApiKey) return;
      if (!cancelled) {
        setIsLoadingStrategies(true);
        setStrategiesError(null);
      }
      try {
        const data = await listStrategies();
        if (!cancelled) setStrategies(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setStrategiesError(err instanceof Error ? err.message : 'No se pudieron cargar las estrategias.');
        }
      } finally {
        if (!cancelled) setIsLoadingStrategies(false);
      }
    };

    void loadStrategies();

    return () => {
      cancelled = true;
    };
  }, [hasApiKey, listStrategies]);

  // Handlers
  const handleWhoScoredTrigger = async () => {
    setIsWhoScoredTriggering(true);
    setWhoScoredError(null);
    try {
      const accepted = await triggerWhoScoredSync();
      setWhoScoredRunId(accepted.runId);
      setWhoScoredStatus({
        runId: accepted.runId,
        status: accepted.status,
        trigger: accepted.trigger,
        startedAt: accepted.startedAt,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setWhoScoredError(err.message);
      } else {
        setWhoScoredError('No se pudo iniciar la actualización de jugadores.');
      }
    } finally {
      setIsWhoScoredTriggering(false);
    }
  };

  const handleFootballDataTrigger = async () => {
    setIsFootballDataSyncing(true);
    setFootballDataError(null);
    try {
      const summary = await triggerFootballDataSync();
      setFootballDataResult(summary);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFootballDataError(err.message);
      } else {
        setFootballDataError('No se pudo actualizar la información de clubes y escudos.');
      }
    } finally {
      setIsFootballDataSyncing(false);
    }
  };

  const handleRecalculateTrigger = async () => {
    setIsRecalculating(true);
    setRecalculateError(null);
    try {
      const result = await recalculateQuotes();
      setRecalculateResult(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setRecalculateError(err.message);
      } else {
        setRecalculateError('No se pudo calcular las cotizaciones.');
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleActivateStrategy = async (strategyId: string) => {
    setActivatingStrategyId(strategyId);
    setStrategiesError(null);
    try {
      await activateStrategy(strategyId);
      const updated = await listStrategies();
      setStrategies(updated);
    } catch (err: unknown) {
      setStrategiesError(err instanceof Error ? err.message : 'No se pudo activar la estrategia.');
    } finally {
      setActivatingStrategyId(null);
    }
  };

  const handleQuickApiKeyGen = async () => {
    setIsGeneratingKey(true);
    setKeySuccessMsg(null);
    try {
      const data = await generateApiKey();
      saveApiKey(data.apiKey);
      setKeySuccessMsg('Clave de administrador emitida y vinculada correctamente.');
    } catch {
      // Ignorar fallo
    } finally {
      setIsGeneratingKey(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="max-w-7xl mx-auto py-16 px-4 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4" />
        <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">
          Cargando panel de administración...
        </p>
      </div>
    );
  }

  // Si no es admin, este panel no se muestra en absoluto
  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      <title>Panel de Administración — FútVal</title>

      {/* Encabezado Principal */}
      <div className="bg-[#104443] border border-[#1a6866] p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-8 border-l-[#b79753]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2dd4bf] bg-[#0b3332] px-2.5 py-0.5 rounded border border-[#2dd4bf]/40">
              PANEL OFICIAL
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332] px-2.5 py-0.5 rounded border border-[#b79753]/40">
              ADMINISTRADOR: {user?.email}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white leading-none">
            Panel de Administración
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 font-medium mt-2 max-w-2xl">
            Centro de control de FútVal para mantener al día el catálogo de futbolistas, la información de clubes europeos
            y los precios de mercado en tu sitio.
          </p>
        </div>

        {/* Estado de Clave de Acceso */}
        <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Estado de clave:</span>
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded ${
                hasApiKey
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {hasApiKey ? 'Activa y Lista' : 'No Vinculada'}
            </span>
          </div>
          {!hasApiKey && (
            <button
              onClick={handleQuickApiKeyGen}
              disabled={isGeneratingKey}
              className="w-full py-1.5 px-3 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-[10px] rounded-lg transition-all"
            >
              {isGeneratingKey ? 'Generando...' : 'Vincular Clave Admin'}
            </button>
          )}
          {keySuccessMsg && <p className="text-[10px] font-bold text-emerald-400">{keySuccessMsg}</p>}
        </div>
      </div>

      {/* Aviso destacado si no tiene clave generada */}
      {!hasApiKey && (
        <div className="bg-[#b79753]/15 border-2 border-[#b79753] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#b79753]">
              Atención: Se requiere clave de acceso
            </h3>
            <p className="text-xs text-gray-200 mt-0.5 font-medium">
              Para poder utilizar las herramientas de actualización a continuación, necesitás tener activa tu clave de
              administrador en este navegador.
            </p>
          </div>
          <button
            onClick={handleQuickApiKeyGen}
            disabled={isGeneratingKey}
            className="px-6 py-2.5 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
          >
            {isGeneratingKey ? 'Generando...' : 'Generar Clave Ahora'}
          </button>
        </div>
      )}

      {/* Grid de 3 Módulos con Imágenes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* Módulo 1: WHOSCORED */}
        <div className="bg-[#104443] border border-[#1a6866] hover:border-[#b79753]/50 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden transition-all group">
          <div className="relative h-44 overflow-hidden border-b border-[#1a6866]">
            <img
              src="/assets/admin_whoscored.jpg"
              alt="Actualización de Jugadores"
              className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#104443] via-[#104443]/40 to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest text-[#2dd4bf] bg-[#0b3332]/90 backdrop-blur-md px-3 py-1 rounded-md border border-[#2dd4bf]/40">
              WHOSCORED
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">
                Actualizar Datos de Jugadores
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed mb-4">
                Recorre los partidos y actualiza los futbolistas de las ligas principales, sumando sus datos más recientes
                de rendimiento: goles, asistencias, tarjetas y minutos jugados.
              </p>

              {/* Estado */}
              {whoScoredStatus && (
                <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-2 mb-4 text-xs font-medium">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Progreso:</span>
                    <span
                      className={`font-black uppercase tracking-wider px-2 py-0.5 rounded text-[10px] ${getWhoScoredBadgeClassName(
                        whoScoredStatus.status,
                      )}`}
                    >
                      {whoScoredStatus.status === 'running' ? 'Actualización en curso' : 'Actualización finalizada'}
                    </span>
                  </div>
                  {whoScoredStatus.playersSynced !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Jugadores procesados:</span>
                      <span className="font-bold text-[#b79753]">{whoScoredStatus.playersSynced}</span>
                    </div>
                  )}
                  {whoScoredStatus.teamsSynced !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Clubes procesados:</span>
                      <span className="font-bold text-white">{whoScoredStatus.teamsSynced}</span>
                    </div>
                  )}
                </div>
              )}

              {whoScoredError && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl mb-4 font-bold">
                  {whoScoredError}
                </div>
              )}
            </div>

            <button
              onClick={handleWhoScoredTrigger}
              disabled={isWhoScoredTriggering || whoScoredStatus?.status === 'running'}
              className="w-full py-3 bg-[#b79753] hover:bg-[#9e8144] disabled:opacity-50 text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl shadow-lg active:scale-95 cursor-pointer mt-2"
            >
              {isWhoScoredTriggering || whoScoredStatus?.status === 'running'
                ? 'Actualizando datos...'
                : 'Iniciar Actualización de Jugadores'}
            </button>
          </div>
        </div>

        {/* Módulo 2: FOOTBALL DATA */}
        <div className="bg-[#104443] border border-[#1a6866] hover:border-[#b79753]/50 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden transition-all group">
          <div className="relative h-44 overflow-hidden border-b border-[#1a6866]">
            <img
              src="/assets/admin_football_data.jpg"
              alt="Clubes y Torneos"
              className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#104443] via-[#104443]/40 to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332]/90 backdrop-blur-md px-3 py-1 rounded-md border border-[#b79753]/40">
              FOOTBALL DATA
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">
                Actualizar Clubes y Escudos
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed mb-4">
                Descarga la información oficial de los clubes europeos, sus escudos institucionales y las posiciones en los
                torneos. Esta tarea suele tomar cerca de un minuto.
              </p>

              {/* Resultados */}
              {footballDataResult && (
                <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-2 mb-4 text-xs font-medium">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Torneos actualizados:</span>
                    <span className="font-bold text-emerald-400">{footballDataResult.leagues.length} ligas</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {footballDataResult.leagues.map((l) => (
                      <span
                        key={l.leagueCode}
                        className="text-[9px] font-bold px-2 py-0.5 bg-[#104443] text-gray-200 rounded border border-white/10"
                      >
                        {l.leagueCode}: {l.standingsSynced} clubes
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {footballDataError && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl mb-4 font-bold">
                  {footballDataError}
                </div>
              )}
            </div>

            <button
              onClick={handleFootballDataTrigger}
              disabled={isFootballDataSyncing}
              className="w-full py-3 bg-[#0e3b3a] hover:bg-[#165756] border border-[#b79753]/40 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest transition-all rounded-xl shadow-lg active:scale-95 cursor-pointer mt-2"
            >
              {isFootballDataSyncing ? 'Actualizando (aprox. 1 min)...' : 'Actualizar Clubes y Escudos'}
            </button>
          </div>
        </div>

        {/* Módulo 3: MOTOR DE PRICING */}
        <div className="bg-[#104443] border border-[#1a6866] hover:border-[#b79753]/50 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden transition-all group">
          <div className="relative h-44 overflow-hidden border-b border-[#1a6866]">
            <img
              src="/assets/admin_pricing.jpg"
              alt="Cotizaciones de Mercado"
              className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#104443] via-[#104443]/40 to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest text-[#c084fc] bg-[#0b3332]/90 backdrop-blur-md px-3 py-1 rounded-md border border-[#c084fc]/40">
              MOTOR DE PRICING
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">
                Calcular Cotizaciones
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed mb-4">
                Calcula en base al rendimiento deportivo el valor de mercado en créditos para cada jugador del catálogo,
                dejando las cotizaciones listas para la consulta pública.
              </p>

              {/* Resultados */}
              {recalculateResult && (
                <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-2 mb-4 text-xs font-medium">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Cotizaciones calculadas:</span>
                    <span className="font-bold text-[#b79753]">{recalculateResult.processedPlayers} jugadores</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Tiempo de proceso:</span>
                    <span className="font-bold text-emerald-400">
                      {(recalculateResult.durationMs / 1000).toFixed(1)} segundos
                    </span>
                  </div>
                </div>
              )}

              {recalculateError && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl mb-4 font-bold">
                  {recalculateError}
                </div>
              )}
            </div>

            <button
              onClick={handleRecalculateTrigger}
              disabled={isRecalculating}
              className="w-full py-3 bg-[#b79753] hover:bg-[#9e8144] disabled:opacity-50 text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl shadow-lg active:scale-95 cursor-pointer mt-2"
            >
              {isRecalculating ? 'Calculando valores...' : 'Calcular Todas las Cotizaciones'}
            </button>
          </div>
        </div>
      </div>

      {/* Módulo de Estrategias de Valuación */}
      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black uppercase tracking-wider text-white mb-1">
              Estrategia de Valuación Activa
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
              Elegí qué estrategia de pesos usa el motor de pricing. El próximo recálculo de cotizaciones usará la que
              esté marcada como activa.
            </p>
          </div>
        </div>

        {strategiesError && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl mb-4 font-bold">
            {strategiesError}
          </div>
        )}

        <StrategiesList
          isLoading={isLoadingStrategies}
          strategies={strategies}
          activatingStrategyId={activatingStrategyId}
          onActivate={handleActivateStrategy}
        />
      </div>
    </div>
  );
};
