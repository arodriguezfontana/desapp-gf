import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCatalog, ApiError } from '../hooks/useCatalog';
import { useApiKey } from '../hooks/useApiKey';
import { getPositionLabel, type Player, type PlayerQuote } from '../types/catalog.types';


export const PlayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasApiKey } = useApiKey();
  const { getPlayerById, getLatestQuoteByPlayerId } = useCatalog();
  const [player, setPlayer] = useState<Player | null>(null);
  const [quote, setQuote] = useState<PlayerQuote | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApiKey || !id) return;

    let isMounted = true;

    const fetchDetail = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [data, latestQuote] = await Promise.all([
          getPlayerById(id),
          getLatestQuoteByPlayerId(id),
        ]);
        if (isMounted) {
          setPlayer(data);
          setQuote(latestQuote);
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
  }, [hasApiKey, id, getPlayerById, getLatestQuoteByPlayerId]);

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

          <div className="flex items-center justify-between gap-4">
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
                  <span className="w-2 h-2 rounded-full bg-[#b79753] inline-block shrink-0"></span>{player.team}
                </p>
              </div>
            </div>

            {/* Valor del token en el header */}
            {quote ? (
              <div className="shrink-0 text-right bg-[#b79753]/10 border border-[#b79753]/30 rounded-2xl px-4 sm:px-6 py-3 sm:py-4">
                <span className="block text-[9px] font-black uppercase tracking-widest text-[#b79753]/60 mb-1">Valor token</span>
                <span className="text-3xl sm:text-5xl font-black text-[#b79753] leading-none tabular-nums">
                  {quote.value.toFixed(2)}
                </span>
                <span className="block text-[9px] font-bold text-[#b79753]/50 uppercase tracking-widest mt-1">créditos</span>
              </div>
            ) : (
              <div className="shrink-0 text-right opacity-30 border border-white/10 rounded-2xl px-4 sm:px-6 py-3 sm:py-4">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Valor token</span>
                <span className="text-3xl sm:text-5xl font-black text-gray-600 leading-none">—</span>
                <span className="block text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1">sin cotización</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 bg-[#0b3332]/60">

          {/* Métricas de rendimiento */}
          <div className="bg-[#104443]/50 rounded-2xl p-4 sm:p-5 border border-[#1a6866]/60">
            <h2 className="text-[9px] font-black uppercase tracking-widest text-[#b79753]/70 mb-3 flex items-center gap-2">
              <span className="w-4 h-px bg-[#b79753]/40 inline-block"></span>
              Métricas de rendimiento
              <span className="w-4 h-px bg-[#b79753]/40 inline-block"></span>
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
              {/* Partidos — tile destacado */}
              <div className="bg-[#0b3332] rounded-xl border border-[#b79753]/40 shadow-md text-center p-3 sm:p-4">
                <span className="block text-[8px] font-black uppercase tracking-wide text-[#b79753]/70 mb-1 leading-tight">Partidos</span>
                <span className="text-2xl sm:text-3xl font-black text-[#b79753]">
                  {player.matchesPlayed ?? <span className="text-gray-600 text-lg">—</span>}
                </span>
              </div>
              {/* Rating — tile destacado */}
              <div className="bg-[#0b3332] rounded-xl border border-[#b79753]/40 shadow-md text-center p-3 sm:p-4">
                <span className="block text-[8px] font-black uppercase tracking-wide text-[#b79753]/70 mb-1 leading-tight">Rating</span>
                <span className="text-2xl sm:text-3xl font-black text-[#b79753]">
                  {player.rating != null ? player.rating.toFixed(2) : <span className="text-gray-600 text-lg">—</span>}
                </span>
              </div>
              {/* Métricas promedio */}
              {[
                { label: 'Pases prom.', value: player.passesCompleted },
                { label: 'Remates prom.', value: player.shots },
                { label: 'Intercepciones prom.', value: player.interceptions },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0b3332]/70 rounded-xl border border-[#1a6866]/50 shadow-md text-center p-3 sm:p-4">
                  <span className="block text-[8px] font-black uppercase tracking-wide text-gray-500 mb-1 leading-tight break-words">{label}</span>
                  <span className="text-lg sm:text-2xl font-black text-gray-200">
                    {value != null ? value.toFixed(1) : <span className="text-gray-600 text-sm">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Estadísticas de temporada */}
          <div className="bg-[#104443]/30 rounded-2xl p-4 sm:p-5 border border-[#1a6866]/40">
            <h2 className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
              <span className="w-4 h-px bg-[#1a6866] inline-block"></span>
              Estadísticas de temporada
              <span className="w-4 h-px bg-[#1a6866] inline-block"></span>
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {[
                { label: 'Goles', value: player.goals },
                { label: 'Asistencias', value: player.assists },
                { label: 'Pases clave', value: player.keyPasses },
                { label: 'Regates', value: player.dribbles },
                { label: 'Entradas', value: player.totalTackles },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0b3332]/50 p-2 sm:p-3 rounded-xl border border-[#1a6866]/40 text-center">
                  <span className="block text-[8px] font-black uppercase tracking-wide text-gray-500 mb-1 leading-tight break-words">{label}</span>
                  <span className="text-base sm:text-xl font-black text-gray-300">
                    {value ?? <span className="text-gray-600 text-sm">—</span>}
                  </span>
                </div>
              ))}
              <div className="bg-[#0b3332]/50 p-2 sm:p-3 rounded-xl border border-yellow-500/30 text-center">
                <span className="block text-[8px] font-black uppercase tracking-wide text-gray-500 mb-1">Amarillas</span>
                <div className="flex items-center justify-center gap-1">
                  <span className="inline-block w-2.5 h-4 rounded-[2px] bg-yellow-400 shrink-0"></span>
                  <span className="text-base sm:text-xl font-black text-yellow-400">
                    {player.yellowCards ?? <span className="text-gray-600 text-sm">—</span>}
                  </span>
                </div>
              </div>
              <div className="bg-[#0b3332]/50 p-2 sm:p-3 rounded-xl border border-red-500/30 text-center">
                <span className="block text-[8px] font-black uppercase tracking-wide text-gray-500 mb-1">Rojas</span>
                <div className="flex items-center justify-center gap-1">
                  <span className="inline-block w-2.5 h-4 rounded-[2px] bg-red-500 shrink-0"></span>
                  <span className="text-base sm:text-xl font-black text-red-400">
                    {player.redCards ?? <span className="text-gray-600 text-sm">—</span>}
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