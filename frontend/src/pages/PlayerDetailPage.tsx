import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCatalog, ApiError } from '../hooks/useCatalog';
import { useApiKey } from '../hooks/useApiKey';
import { getPositionLabel, type Player, type PlayerQuote } from '../types/catalog.types';

// ── Mismos accentos que PlayerCard ──────────────────────────────────────────
const POSITION_ACCENT: Record<string, { from: string; via: string; text: string }> = {
  GK: { from: '#b79753', via: '#8a6f35', text: '#b79753' },
  DF: { from: '#3b82f6', via: '#1d4ed8', text: '#60a5fa' },
  MF: { from: '#2dd4bf', via: '#0d9488', text: '#2dd4bf' },
  FW: { from: '#a855f7', via: '#7c3aed', text: '#c084fc' },
};
const getAccent = (pos: string) =>
  POSITION_ACCENT[pos] ?? { from: '#b79753', via: '#8a6f35', text: '#b79753' };

// ── Componente de métrica individual ────────────────────────────────────────
const StatBlock: React.FC<{
  label: string;
  value: number | null | undefined;
  color: string;
  highlight?: boolean;
}> = ({ label, value, color, highlight }) => (
  <div
    className={`flex flex-col items-center justify-center gap-1 rounded-xl p-3 border text-center transition-all ${
      highlight ? 'border-opacity-60' : 'border-white/8'
    }`}
    style={{
      backgroundColor: highlight ? `${color}18` : 'rgba(0,0,0,0.25)',
      borderColor: highlight ? `${color}50` : undefined,
    }}
  >
    <span className="text-xl font-black tabular-nums" style={{ color: highlight ? color : '#e2e8f0' }}>
      {value ?? <span className="text-white/20 text-base">—</span>}
    </span>
    <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{label}</span>
  </div>
);

// ── Barra de rating ──────────────────────────────────────────────────────────
const RatingBar: React.FC<{ label: string; value: number | null; max?: number; color: string }> = ({
  label, value, max = 10, color,
}) => {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/40 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
        />
      </div>
      <span className="text-xs font-black tabular-nums w-10 text-right" style={{ color }}>
        {value != null ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
};

// ── Página ───────────────────────────────────────────────────────────────────
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
        if (isMounted) { setPlayer(data); setQuote(latestQuote); }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiError) setErrorMessage(err.message);
        else if (err instanceof Error && err.message !== 'ApiKey no válida o expirada.')
          setErrorMessage(err.message);
        else setErrorMessage('Error al cargar la información del jugador.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchDetail();
    return () => { isMounted = false; };
  }, [hasApiKey, id, getPlayerById, getLatestQuoteByPlayerId]);

  if (!hasApiKey) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-[#104443] border-2 border-[#b79753]/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#0b3332] border border-[#b79753] text-[#b79753] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">🔑</div>
          <h2 className="text-2xl font-black uppercase tracking-wider text-white mb-3">Clave de Acceso Requerida</h2>
          <p className="text-base text-gray-300 font-medium mb-6">Necesitás generar una ApiKey para ver el catálogo.</p>
          <Link to="/account" className="inline-flex items-center gap-2 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-xl cursor-pointer">
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-3 sm:px-6">
        <div className="bg-[#104443] rounded-2xl p-12 border border-[#1a6866] text-center shadow-2xl">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4" />
          <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">Cargando ficha del jugador...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-3 sm:px-6">
        <div className="bg-[#104443] border-2 border-[#f43f5e] rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/40 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">!</div>
          <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">Información de Jugador</h2>
          <p className="text-sm font-bold text-gray-200">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (!player) return null;

  const accent = getAccent(player.position);

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-8 px-3 sm:px-6 animate-fade-in">
      <title>{`${player.name} — FútVal`}</title>

      {/* Volver */}
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/40 hover:text-[#b79753] mb-6 transition-colors"
      >
        ← Volver al catálogo
      </Link>

      {/* ── Card FIFA expandida ── */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: 'linear-gradient(160deg, #0e4040 0%, #072221 55%, #041915 100%)' }}
      >
        {/* Franja de posición */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.via})` }} />

        {/* ── HERO: info principal ── */}
        <div className="relative flex flex-col">
          {/* Glow de fondo */}
          <div
            className="absolute inset-0 opacity-15 blur-3xl pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 25% 60%, ${accent.from}99 0%, transparent 65%)` }}
          />

          {/* Datos principales */}
          <div className="flex-1 flex flex-col justify-between p-6 sm:p-8">
            {/* Valor del token a la izquierda, info del jugador centrada */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
              {/* Valor del token */}
              <div className="flex flex-col items-start leading-none">
                <span className="text-5xl font-black tabular-nums drop-shadow-lg" style={{ color: accent.text }}>
                  {quote != null ? Math.round(quote.value) : '—'}
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest mt-1" style={{ color: accent.text }}>
                  Valor token
                </span>
                {quote != null && (
                  <span className="text-[9px] font-bold text-white/40 mt-1">
                    {quote.appliedPosition != null
                      ? `Perfil de posición (${getPositionLabel(quote.appliedPosition)})`
                      : 'Pesos generales de la estrategia'}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-4 min-w-0">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                  {player.crestUrl ? (
                    <img
                      src={player.crestUrl}
                      alt={player.team}
                      className="w-full h-full object-contain drop-shadow-lg"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        (e.currentTarget.parentElement as HTMLElement).textContent = '⚽';
                      }}
                    />
                  ) : (
                    <span className="text-3xl select-none">⚽</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span
                      className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border"
                      style={{ color: accent.text, borderColor: `${accent.from}50`, backgroundColor: `${accent.from}18` }}
                    >
                      {getPositionLabel(player.position)}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-white/10 text-white/50">
                      {player.league}
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white leading-tight line-clamp-2">
                    {player.name}
                  </h1>
                  <p className="font-bold text-sm mt-1 flex items-center gap-2" style={{ color: accent.text }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: accent.from }} />{' '}
                    {player.team}
                  </p>
                </div>
              </div>

              <div />
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="border-t border-white/8 p-5 sm:p-8 space-y-6" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>

          {/* Rendimiento: rating bars */}
          <div>
            <h2 className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-3" style={{ color: `${accent.text}80` }}>
              <span className="flex-1 h-px" style={{ backgroundColor: `${accent.from}40` }} />{' '}
              Métricas de rendimiento{' '}
              <span className="flex-1 h-px" style={{ backgroundColor: `${accent.from}40` }} />
            </h2>
            <div className="space-y-2.5">
              {/* max de cada barra = NORMALIZATION_BOUNDS del backend (calculate-player-value.ts):
                  rating/pases/remates/intercepciones son promedio por partido, no acumulado de temporada */}
              <RatingBar label="Rating" value={player.rating} max={10} color={accent.text} />
              <RatingBar label="Pases compl." value={player.passesCompleted} max={100} color="#60a5fa" />
              <RatingBar label="Remates" value={player.shots} max={6} color="#2dd4bf" />
              <RatingBar label="Intercepciones" value={player.interceptions} max={4} color="#a855f7" />
            </div>
          </div>

          {/* Estadísticas de temporada */}
          <div>
            <h2 className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-3 text-white/25">
              <span className="flex-1 h-px bg-white/8" />{' '}
              Estadísticas de temporada{' '}
              <span className="flex-1 h-px bg-white/8" />
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              <StatBlock label="Goles" value={player.goals} color="#2dd4bf" highlight />
              <StatBlock label="Asistencias" value={player.assists} color="#b79753" highlight />
              <StatBlock label="Pases clave" value={player.keyPasses} color={accent.text} highlight />
              <StatBlock label="Regates" value={player.dribbles} color="#c084fc" />
              <StatBlock label="Entradas" value={player.totalTackles} color="#60a5fa" />
              <StatBlock label="Amarillas" value={player.yellowCards} color="#facc15" />
              <StatBlock label="Rojas" value={player.redCards} color="#f87171" />
            </div>
          </div>

          {/* Partidos */}
          {player.matchesPlayed != null && (
            <div className="flex items-center justify-between rounded-xl px-5 py-3 border border-white/8" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Partidos jugados</span>
              <span className="text-2xl font-black" style={{ color: accent.text }}>{player.matchesPlayed}</span>
            </div>
          )}
        </div>

        {/* Franja de color inferior */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent.via}, ${accent.from})` }} />
      </div>
    </div>
  );
};