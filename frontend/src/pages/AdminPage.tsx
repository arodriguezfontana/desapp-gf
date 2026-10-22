import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAdmin } from '../hooks/useAdmin';
import { useApiKey } from '../hooks/useApiKey';
import { useAuthActions } from '../hooks/useAuthActions';
import type {
  RecalculateQuotesResultDto,
  SimulationResultDto,
  SyncRunStatusDto,
  SyncSummaryDto,
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

export const AdminPage: React.FC = () => {
  const { user, isAdmin, isLoading: isUserLoading } = useCurrentUser();
  const {
    triggerWhoScoredSync,
    getWhoScoredRunStatus,
    triggerFootballDataSync,
    simulateMarket,
    recalculateQuotes,
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

  // Estados de Simulación de Mercado
  const [isSimulatingMarket, setIsSimulatingMarket] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResultDto | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Estados de Recálculo Global de Cotizaciones
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalculateResult, setRecalculateResult] = useState<RecalculateQuotesResultDto | null>(null);
  const [recalculateError, setRecalculateError] = useState<string | null>(null);

  // Generación de clave de acceso
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);
  const [keySuccessMsg, setKeySuccessMsg] = useState<string | null>(null);

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

  const handleSimulateMarket = async () => {
    setIsSimulatingMarket(true);
    setSimulationError(null);
    try {
      const result = await simulateMarket();
      setSimulationResult(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSimulationError(err.message);
      } else {
        setSimulationError('No se pudo ejecutar la simulación de mercado.');
      }
    } finally {
      setIsSimulatingMarket(false);
    }
  };

  const handleRecalculateQuotes = async () => {
    setIsRecalculating(true);
    setRecalculateError(null);
    try {
      const result = await recalculateQuotes();
      setRecalculateResult(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setRecalculateError(err.message);
      } else {
        setRecalculateError('No se pudo recalcular las cotizaciones.');
      }
    } finally {
      setIsRecalculating(false);
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
            Centro de control de FútVal para mantener al día el catálogo de futbolistas, la información de clubes europeos,
            los precios de mercado y la simulación interactiva completa de la plataforma.
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
              className="w-full py-1.5 px-3 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-[10px] rounded-lg transition-all cursor-pointer"
            >
              {isGeneratingKey ? 'Generando...' : 'Vincular Clave Admin'}
            </button>
          )}
          {keySuccessMsg && <p className="text-[10px] font-bold text-emerald-400">{keySuccessMsg}</p>}
        </div>
      </div>

      {/* Aviso si no tiene clave generada */}
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

      {/* Grid de Módulos 1, 2 y 3 */}
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
              className="w-full py-3 bg-[#b79753] hover:bg-[#9e8144] disabled:opacity-50 text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl shadow-lg active:scale-95 cursor-pointer mt-2"
            >
              {isFootballDataSyncing ? 'Actualizando (aprox. 1 min)...' : 'Actualizar Clubes y Escudos'}
            </button>
          </div>
        </div>

        {/* Módulo 3: RECÁLCULO DE COTIZACIONES */}
        <div className="bg-[#104443] border border-[#1a6866] hover:border-[#b79753]/50 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden transition-all group">
          <div className="relative h-44 overflow-hidden border-b border-[#1a6866]">
            <img
              src="/assets/admin_pricing.jpg"
              alt="Cotizaciones"
              className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#104443] via-[#104443]/40 to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332]/90 backdrop-blur-md px-3 py-1 rounded-md border border-[#b79753]/40">
              COTIZACIONES
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">
                Recalcular Cotizaciones del Sistema
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed mb-4">
                Recalcula y persiste una cotización por cada combinación usuario × jugador del sistema, usando la
                estrategia seleccionada de cada usuario. Afecta a todos los usuarios, no solo a tu cuenta.
              </p>

              {/* Resultados */}
              {recalculateResult && (
                <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-2 mb-4 text-xs font-medium">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Cotizaciones actualizadas:</span>
                    <span className="font-bold text-emerald-400">{recalculateResult.recalculated.length}</span>
                  </div>
                  {recalculateResult.skipped.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-gray-400">
                        Combinaciones salteadas ({recalculateResult.skipped.length}):
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {recalculateResult.skipped.map((s) => (
                          <span
                            key={`${s.userId}-${s.playerId}`}
                            title={s.reason}
                            className="text-[9px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded border border-rose-500/30"
                          >
                            {s.playerId.slice(0, 8)}…
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {recalculateError && (
                <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl mb-4 font-bold">
                  {recalculateError}
                </div>
              )}
            </div>

            <button
              onClick={handleRecalculateQuotes}
              disabled={isRecalculating}
              className="w-full py-3 bg-[#b79753] hover:bg-[#9e8144] disabled:opacity-50 text-[#0b3332] font-black uppercase text-xs tracking-widest transition-all rounded-xl shadow-lg active:scale-95 cursor-pointer mt-2"
            >
              {isRecalculating ? 'Recalculando...' : 'Recalcular'}
            </button>
          </div>
        </div>
      </div>

      {/* MÓDULO 3: SIMULACIÓN DE MERCADO Y ACTIVIDAD INTERACTIVA */}
      <div className="bg-[#104443] border-2 border-[#b79753]/60 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#1a6866] pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0b3332] bg-[#b79753] px-3 py-1 rounded-md font-mono">
                MÓDULO 3 · SIMULACIÓN INTERACTIVA
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#2dd4bf] bg-[#0b3332] px-2.5 py-0.5 rounded border border-[#2dd4bf]/40">
                DATOS DE ALTO VOLUMEN
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
              Simulación de Mercado y Actividad Interactiva
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-3xl leading-relaxed">
              Genera instantáneamente un entorno de mercado vivo con transacciones de compra/venta históricas, tokens en tu
              portfolio personal, órdenes activas e históricas (con cancelación operativa) y profundidad en el libro de
              órdenes para los futbolistas del catálogo.
            </p>
          </div>

          <button
            onClick={handleSimulateMarket}
            disabled={isSimulatingMarket}
            className="px-8 py-4 bg-gradient-to-r from-[#b79753] to-[#d4af37] hover:from-[#9e8144] hover:to-[#b79753] disabled:opacity-50 text-[#0b3332] font-black uppercase text-sm tracking-widest rounded-xl shadow-xl transition-all active:scale-95 cursor-pointer shrink-0 border border-white/30 flex items-center justify-center gap-3"
          >
            {isSimulatingMarket ? (
              <>
                <span className="animate-spin text-lg">⚙️</span>
                <span>Simulando Mercado...</span>
              </>
            ) : (
              <>
                <span className="text-base">⚡</span>
                <span>Ejecutar Simulación Completa</span>
              </>
            )}
          </button>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-1.5">
            <div className="text-xl">💼</div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Portfolio & Rendimientos</h3>
            <p className="text-[11px] text-gray-300 leading-snug">
              Carga tokens de múltiples futbolistas con P&L, cálculo de ROI e inversión neta acumulada.
            </p>
          </div>

          <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-1.5">
            <div className="text-xl">📈</div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Gráfico de Evolución</h3>
            <p className="text-[11px] text-gray-300 leading-snug">
              12 transacciones cronológicas de compra (violeta) y venta (ámbar) en los últimos 14 días.
            </p>
          </div>

          <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-1.5">
            <div className="text-xl">📋</div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Órdenes en 4 Estados</h3>
            <p className="text-[11px] text-gray-300 leading-snug">
              Órdenes Pendiente, Parcial, Completada y Cancelada. Cancelación interactiva en vivo disponible.
            </p>
          </div>

          <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-1.5">
            <div className="text-xl">📊</div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Profundidad de Mercado L2</h3>
            <p className="text-[11px] text-gray-300 leading-snug">
              Libro de órdenes activo con niveles de Bids y Asks para los futbolistas en el catálogo.
            </p>
          </div>
        </div>

        {/* Mensaje de Error */}
        {simulationError && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-4 rounded-xl font-bold flex items-center gap-3">
            <span>⚠️</span>
            <span>{simulationError}</span>
          </div>
        )}

        {/* Resultados de la Simulación */}
        {simulationResult && (
          <div className="bg-[#0b3332] border border-[#2dd4bf]/40 rounded-xl p-5 sm:p-6 space-y-4 animate-fade-in shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a6866] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-base">✅</span>
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Simulación ejecutada con éxito para {simulationResult.adminEmail}
                </span>
              </div>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 bg-[#2dd4bf] hover:bg-[#20b8a5] text-[#0b3332] font-black uppercase tracking-widest text-[11px] px-4 py-2 rounded-lg shadow-md transition-all self-start sm:self-auto cursor-pointer"
              >
                <span>Ver Mi Portfolio Ahora</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-[#104443] p-3 rounded-lg border border-[#1a6866]">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Holdings</span>
                <span className="text-lg font-black text-[#b79753]">{simulationResult.holdingsCreated}</span>
              </div>
              <div className="bg-[#104443] p-3 rounded-lg border border-[#1a6866]">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Transacciones</span>
                <span className="text-lg font-black text-white">{simulationResult.transactionsCreated}</span>
              </div>
              <div className="bg-[#104443] p-3 rounded-lg border border-[#1a6866]">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Órdenes Propias</span>
                <span className="text-lg font-black text-emerald-400">{simulationResult.ordersCreated}</span>
              </div>
              <div className="bg-[#104443] p-3 rounded-lg border border-[#1a6866]">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Libro L2</span>
                <span className="text-lg font-black text-[#2dd4bf]">{simulationResult.marketOrdersCreated}</span>
              </div>
              <div className="bg-[#104443] p-3 rounded-lg border border-[#1a6866] col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Cotizaciones</span>
                <span className="text-lg font-black text-purple-300">{simulationResult.quotesCreated}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Futbolistas involucrados en la simulación:
              </span>
              <div className="flex flex-wrap gap-2">
                {simulationResult.playersInvolved.map((pName) => (
                  <span
                    key={pName}
                    className="text-[10px] font-bold px-2.5 py-1 bg-[#104443] text-gray-200 rounded-md border border-[#1a6866]"
                  >
                    ⚽ {pName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
