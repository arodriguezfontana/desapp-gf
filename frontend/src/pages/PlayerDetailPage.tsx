import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCatalog, ApiError } from '../hooks/useCatalog';
import { useApiKey } from '../hooks/useApiKey';
import { getPositionLabel, type Player } from '../types/catalog.types';

const CircularMetric: React.FC<{
  value: number | null | undefined;
  label: string;
  max: number;
  subtitle: string;
}> = ({ value, label, max, subtitle }) => {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const pct = value != null && value > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="bg-[#0b3332] rounded-xl border border-[#1a6866] shadow-md flex flex-col items-center p-2 sm:p-4 gap-1">
      <div className="relative w-16 h-16 sm:w-24 sm:h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1a6866" strokeWidth="8" />
          {pct > 0 && (
            <circle
              cx="50" cy="50" r={r}
              fill="none"
              stroke="#b79753"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
          )}
          {pct === 0 && <circle cx="50" cy="50" r="4" fill="#1a6866" />}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm sm:text-lg font-black text-white">
            {value != null ? value.toFixed(2) : '—'}
          </span>
        </div>
      </div>
      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-[#b79753] text-center leading-tight">{label}</span>
      <span className="text-[8px] sm:text-[9px] text-gray-500">{subtitle}</span>
    </div>
  );
};

export const PlayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasApiKey } = useApiKey();
  const { getPlayerById } = useCatalog();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApiKey || !id) return;

    let isMounted = true;

    const fetchDetail = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getPlayerById(id);
        if (isMounted) {
          setPlayer(data);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else if (err instanceof Error && err.message !== 'ApiKey no válida o expirada.') {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Error al cargar la información del jugador.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [hasApiKey, id, getPlayerById]);

  let detailContent: React.ReactNode;
  if (isLoading) {
    detailContent = (
      <div className="bg-[#104443] rounded-2xl p-12 border border-[#1a6866] text-center shadow-2xl">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4"></div>
        <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">
          Cargando ficha del jugador...
        </p>
      </div>
    );
  } else if (errorMessage) {
    detailContent = (
      <div className="bg-[#104443] border-2 border-[#f43f5e] rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-12 h-12 bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/40 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">Información de Jugador</h2>
        <p className="text-sm font-bold text-gray-200">{errorMessage}</p>
      </div>
    );
  } else if (player) {
    detailContent = (
      <div className="bg-[#104443] rounded-2xl border border-[#b79753]/30 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#0b3332] via-[#104443] to-[#0b3332] p-5 sm:p-8 text-white border-b border-[#1a6866]">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-[#b79753] text-[#0b3332] font-black text-[10px] px-3 py-0.5 rounded-md uppercase tracking-widest">
              {getPositionLabel(player.position)}
            </span>
            <span className="bg-[#0b3332] text-[#b79753] font-bold text-[10px] px-3 py-0.5 rounded-md border border-[#b79753]/30">
              {player.league}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {player.crestUrl && (
              <img
                src={player.crestUrl}
                alt={player.team}
                className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow-md shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <h1 className="text-xl sm:text-4xl font-black tracking-wider uppercase leading-tight">
                {player.name}
              </h1>
              <p className="text-[#b79753] font-bold text-sm sm:text-lg flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#b79753] inline-block shrink-0"></span>
                {player.team}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 bg-[#0b3332]/60">

          {/* Métricas de rendimiento */}
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Métricas de rendimiento <span className="text-gray-600 normal-case">(promedio por partido)</span>
            </h2>
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              <CircularMetric value={player.rating} label="Rating" max={10} subtitle="sobre 10" />
              <CircularMetric value={player.passesCompleted} label="Pases completados" max={player.matchesPlayed ?? 40} subtitle={player.matchesPlayed ? `sobre ${player.matchesPlayed} PJ` : '—'} />
              <CircularMetric value={player.shots} label="Remates" max={player.matchesPlayed ?? 10} subtitle={player.matchesPlayed ? `sobre ${player.matchesPlayed} PJ` : '—'} />
              <CircularMetric value={player.interceptions} label="Intercepciones" max={player.matchesPlayed ?? 10} subtitle={player.matchesPlayed ? `sobre ${player.matchesPlayed} PJ` : '—'} />
            </div>
          </div>

          {/* Estadísticas de temporada */}
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Estadísticas de temporada <span className="text-gray-600 normal-case">(totales acumulados)</span>
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
              {[
                { label: 'Goles', value: player.goals, color: 'text-white' },
                { label: 'Asistencias', value: player.assists, color: 'text-white' },
                { label: 'Pases clave', value: player.keyPasses, color: 'text-white' },
                { label: 'Regates', value: player.dribbles, color: 'text-white' },
                { label: 'Entradas', value: player.totalTackles, color: 'text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#0b3332] p-2 sm:p-4 rounded-xl border border-[#1a6866] shadow-md text-center">
                  <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-[#b79753] mb-1 sm:mb-1.5 leading-tight break-words">
                    {label}
                  </span>
                  <span className={`text-base sm:text-xl font-black ${color}`}>
                    {value != null ? value : <span className="text-gray-500 text-sm">—</span>}
                  </span>
                </div>
              ))}
              {/* Amarillas */}
              <div className="bg-[#0b3332] p-2 sm:p-4 rounded-xl border border-yellow-500/40 shadow-md text-center">
                <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-[#b79753] mb-1 sm:mb-1.5">Amarillas</span>
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <span className="inline-block w-3 h-4 sm:w-3.5 sm:h-5 rounded-[2px] bg-yellow-400 shadow-sm shadow-yellow-400/40 shrink-0"></span>
                  <span className="text-base sm:text-xl font-black text-yellow-400">
                    {player.yellowCards != null ? player.yellowCards : <span className="text-gray-500 text-sm">—</span>}
                  </span>
                </div>
              </div>
              {/* Rojas */}
              <div className="bg-[#0b3332] p-2 sm:p-4 rounded-xl border border-red-500/40 shadow-md text-center">
                <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-[#b79753] mb-1 sm:mb-1.5">Rojas</span>
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <span className="inline-block w-3 h-4 sm:w-3.5 sm:h-5 rounded-[2px] bg-red-500 shadow-sm shadow-red-500/40 shrink-0"></span>
                  <span className="text-base sm:text-xl font-black text-red-400">
                    {player.redCards != null ? player.redCards : <span className="text-gray-500 text-sm">—</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    detailContent = null;
  }

  if (!hasApiKey) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-[#104443] border-2 border-[#b79753]/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753] text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
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
            className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-xl hover:shadow-[#b79753]/40 cursor-pointer"
          >
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
      <title>{player ? `${player.name} — FútVal` : 'Detalle de Jugador — FútVal'}</title>

      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#b79753] hover:text-white mb-6 transition-colors"
      >
        &larr; Volver al catálogo
      </Link>

      {detailContent}
    </div>
  );
};