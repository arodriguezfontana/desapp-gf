import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCatalog, ApiError } from '../hooks/useCatalog';
import { useApiKey } from '../hooks/useApiKey';
import { useCreateOrder } from '../hooks/useCreateOrder';
import { usePortfolio } from '../hooks/usePortfolio';
import { getPositionLabel, type Player, type PlayerQuote } from '../types/catalog.types';
import type { PlayerValuationResponseDto } from '../types/userStrategy.types';
import type { OrderSide } from '../types/orders.types';
import { QuoteHistoryChart } from '../components/QuoteHistoryChart';
import { OrderConfirmDialog } from '../components/OrderConfirmDialog';

// ── Mismos accentos que PlayerCard ──────────────────────────────────────────
const POSITION_ACCENT: Record<string, { from: string; via: string; text: string }> = {
  GK: { from: '#b79753', via: '#8a6f35', text: '#b79753' },
  DF: { from: '#8b5cf6', via: '#1d4ed8', text: '#a78bfa' },
  MF: { from: '#2dd4bf', via: '#0d9488', text: '#2dd4bf' },
  FW: { from: '#a855f7', via: '#7c3aed', text: '#c084fc' },
};
const getAccent = (pos: string) =>
  POSITION_ACCENT[pos] ?? { from: '#b79753', via: '#8a6f35', text: '#b79753' };

// ── Silueta SVG por posición ────────────────────────────────────────────────
const POSITION_SILHOUETTE: Record<string, string> = {
  GK: '/assets/player_silhouette_gk.svg',
  DF: '/assets/player_silhouette_df.svg',
  MF: '/assets/player_silhouette_mf.svg',
  FW: '/assets/player_silhouette_fw.svg',
};
const getSilhouette = (pos: string) =>
  POSITION_SILHOUETTE[pos] ?? '/assets/player_silhouette_mf.svg';

// ── Componente de métrica individual ────────────────────────────────────────
const StatBlock: React.FC<{
  label: string;
  value: number | null | undefined;
  color: string;
  highlight?: boolean;
  size?: 'lg' | 'sm';
}> = ({ label, value, color, highlight, size = 'sm' }) => (
  <div
    className={`flex flex-col items-center justify-center rounded-xl border text-center transition-all ${
      size === 'lg' ? 'p-3 sm:p-4' : 'p-2.5 sm:p-3'
    } ${highlight ? 'border-opacity-60 shadow-lg' : 'border-white/8'}`}
    style={{
      backgroundColor: highlight ? `${color}18` : 'rgba(0,0,0,0.25)',
      borderColor: highlight ? `${color}50` : undefined,
    }}
  >
    <span
      className={`font-black tabular-nums leading-none ${size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}
      style={{ color: highlight ? color : '#e2e8f0' }}
    >
      {value ?? <span className="text-white/20 text-sm">—</span>}
    </span>
    <span
      className={`font-black uppercase tracking-widest mt-1.5 line-clamp-1 ${
        size === 'lg' ? 'text-[9px] sm:text-[10px] text-white/70' : 'text-[8px] sm:text-[9px] text-white/50'
      }`}
    >
      {label}
    </span>
  </div>
);

// ── Card de métrica de rendimiento ──────────────────────────────────────────
const RatingCard: React.FC<{ label: string; value: number | null; max?: number; color: string }> = ({
  label, value, max = 10, color,
}) => {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="rounded-xl p-3 sm:p-3.5 border border-white/8 bg-black/30 flex flex-col justify-between transition-all hover:border-white/15">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/70">{label}</span>
        <span className="text-base sm:text-lg font-black tabular-nums" style={{ color }}>
          {value != null ? value.toFixed(1) : '—'}
        </span>
      </div>
      <div className="h-2 bg-white/8 rounded-full overflow-hidden w-full">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
        />
      </div>
    </div>
  );
};

// ── Página ───────────────────────────────────────────────────────────────────
export const PlayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasApiKey } = useApiKey();
  const { getPlayerById, getMyValuationByPlayerId, getQuoteHistoryByPlayerId } = useCatalog();
  const { createOrder, isSubmitting: isSubmittingOrder, error: orderError } = useCreateOrder();
  const { holdings } = usePortfolio();
  const ownedQuantity = holdings.find((h) => h.playerId === id)?.tokenQuantity ?? 0;
  const [player, setPlayer] = useState<Player | null>(null);
  const [quote, setQuote] = useState<PlayerValuationResponseDto | null>(null);
  const [quoteHistory, setQuoteHistory] = useState<PlayerQuote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderDialogSide, setOrderDialogSide] = useState<OrderSide | null>(null);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  const handleConfirmOrder = async (quantity: number) => {
    if (!id || !orderDialogSide) return;
    const order = await createOrder(orderDialogSide, id, quantity);
    if (order) {
      setOrderDialogSide(null);
      const sideLabel = orderDialogSide === 'BUY' ? 'Compra' : 'Venta';
      setOrderSuccessMessage(
        order.status === 'COMPLETED'
          ? `${sideLabel} ejecutada por completo (${quantity} tokens a ${order.price}).`
          : order.status === 'PARTIALLY_FILLED'
            ? `${sideLabel} ejecutada parcialmente; el resto queda pendiente en el libro.`
            : `${sideLabel} publicada; queda pendiente hasta encontrar una contraparte al mismo precio.`,
      );
    }
  };

  useEffect(() => {
    if (!hasApiKey || !id) return;
    let isMounted = true;

    const fetchDetail = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [data, myValuation, history] = await Promise.all([
          getPlayerById(id),
          getMyValuationByPlayerId(id),
          getQuoteHistoryByPlayerId(id),
        ]);
        if (isMounted) { setPlayer(data); setQuote(myValuation); setQuoteHistory(history); }
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
  }, [hasApiKey, id, getPlayerById, getMyValuationByPlayerId, getQuoteHistoryByPlayerId]);

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
    <div className="max-w-7xl mx-auto pt-3 sm:pt-6 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <title>{`${player.name} — FútVal`}</title>

      {/* Volver */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/40 hover:text-[#b79753] mb-4 transition-colors cursor-pointer"
      >
        ← Volver al catálogo
      </button>

      {/* ── Card FIFA expandida (Dashboard a pantalla completa) ── */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-8 sm:mb-12"
        style={{ background: 'linear-gradient(160deg, #0e4040 0%, #072221 55%, #041915 100%)' }}
      >
        {/* Franja de posición superior */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.via})` }} />

        {/* ── Grid Principal de 2 Columnas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10 min-h-[580px]">

          {/* ════════ COLUMNA IZQUIERDA: SHOWCASE DEL JUGADOR CON IMÁGENES ════════ */}
          <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 relative overflow-hidden">
            {/* Glow detrás de la silueta */}
            <div
              className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 50%, ${accent.from}99 0%, transparent 65%)` }}
            />

            {/* Cabecera izquierda: Valor del Token + Escudo del Club */}
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="flex flex-col items-start leading-none">
                <span className="text-5xl sm:text-6xl font-black tabular-nums drop-shadow-lg" style={{ color: accent.text }}>
                  {quote != null ? Math.round(quote.value) : '—'}
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest mt-1.5" style={{ color: accent.text }}>
                  Valor token
                </span>
                {quote != null && (
                  <span className="text-[9px] font-bold text-white/50 mt-1.5 max-w-[240px] leading-tight">
                    {quote.appliedPosition != null
                      ? `Perfil de posición (${getPositionLabel(quote.appliedPosition)})`
                      : 'Pesos generales de la estrategia'}
                  </span>
                )}
                {quote != null && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setOrderDialogSide('BUY')}
                      className="px-4 py-2 text-[11px] font-black uppercase tracking-widest bg-[#a78bfa] hover:bg-[#8b5cf6] text-[#0b3332] shadow-md transition-all rounded-xl cursor-pointer active:scale-95"
                    >
                      Comprar
                    </button>
                    {ownedQuantity > 0 && (
                      <button
                        type="button"
                        onClick={() => setOrderDialogSide('SELL')}
                        className="px-4 py-2 text-[11px] font-black uppercase tracking-widest bg-[#f59e0b] hover:bg-[#d97706] text-[#0b3332] shadow-md transition-all rounded-xl cursor-pointer active:scale-95"
                      >
                        Vender
                      </button>
                    )}
                  </div>
                )}
                {orderSuccessMessage && (
                  <p className="text-[10px] font-bold text-[#2dd4bf] mt-2 max-w-[260px] leading-tight">
                    {orderSuccessMessage}
                  </p>
                )}
              </div>

              {/* Escudo del club */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0b3332]/80 border border-[#b79753]/40 flex items-center justify-center p-2.5 shadow-inner shrink-0 overflow-hidden">
                {player.crestUrl ? (
                  <img
                    src={player.crestUrl}
                    alt={player.team}
                    className="w-full h-full object-contain drop-shadow"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      (e.currentTarget.parentElement as HTMLElement).textContent = '⚽';
                    }}
                  />
                ) : (
                  <span className="text-3xl select-none">⚽</span>
                )}
              </div>
            </div>

            {/* Silueta central del jugador */}
            <div className="relative z-0 flex justify-center items-center my-4 select-none pointer-events-none">
              <img
                src={getSilhouette(player.position)}
                alt="Silueta del jugador"
                className="h-56 sm:h-64 lg:h-72 object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-105"
                draggable={false}
              />
            </div>

            {/* Pie de la columna izquierda: Badges, Nombre y Equipo */}
            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-2 mb-2">
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

              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white leading-tight line-clamp-1">
                {player.name}
              </h1>

              <div className="flex items-center justify-between text-sm font-bold mt-2 pt-2 border-t border-white/10">
                <p className="flex items-center gap-2 truncate" style={{ color: accent.text }}>
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: accent.from }} />
                  <span className="truncate">{player.team}</span>
                </p>
                {player.matchesPlayed != null && (
                  <div className="flex items-center gap-1.5 text-xs text-white/50 shrink-0 ml-3">
                    <span>Partidos jugados:</span>
                    <span className="font-black text-sm" style={{ color: accent.text }}>{player.matchesPlayed}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════ COLUMNA DERECHA: DASHBOARD DE ESTADÍSTICAS & EVOLUCIÓN ════════ */}
          <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 space-y-6 sm:space-y-8" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>

            {/* 1. Métricas de Rendimiento */}
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: `${accent.text}90` }}>
                <span className="w-4 h-px" style={{ backgroundColor: `${accent.from}60` }} />
                Métricas de rendimiento
                <span className="flex-1 h-px bg-white/10" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <RatingCard label="Rating" value={player.rating} max={10} color={accent.text} />
                <RatingCard label="Pases compl." value={player.passesCompleted} max={100} color="#a78bfa" />
                <RatingCard label="Remates" value={player.shots} max={6} color="#2dd4bf" />
                <RatingCard label="Intercepciones" value={player.interceptions} max={4} color="#a855f7" />
              </div>
            </div>

            {/* 2. Estadísticas de Temporada */}
            <div className="space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white/40">
                <span className="w-4 h-px bg-white/20" />
                Estadísticas de temporada
                <span className="flex-1 h-px bg-white/10" />
              </h2>

              {/* Tridente Ofensivo: Goles (#2dd4bf), Asistencias (#b79753), Pases Clave (accent.text) */}
              <div className="grid grid-cols-3 gap-3">
                <StatBlock label="Goles" value={player.goals} color="#2dd4bf" highlight size="lg" />
                <StatBlock label="Asistencias" value={player.assists} color="#b79753" highlight size="lg" />
                <StatBlock label="Pases clave" value={player.keyPasses} color={accent.text} highlight size="lg" />
              </div>

              {/* Métricas complementarias: Regates, Entradas, Amarillas, Rojas */}
              <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
                <StatBlock label="Regates" value={player.dribbles} color="#c084fc" />
                <StatBlock label="Entradas" value={player.totalTackles} color="#a78bfa" />
                <StatBlock label="Amarillas" value={player.yellowCards} color="#facc15" />
                <StatBlock label="Rojas" value={player.redCards} color="#f87171" />
              </div>
            </div>

            {/* 3. Evolución del Valor */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white/40">
                  <span className="w-4 h-px bg-white/20" />
                  <span>Tu valuación de este jugador en el tiempo</span>
                  <span className="flex-1 h-px bg-white/10" />
                </h2>
              </div>
              <QuoteHistoryChart quotes={quoteHistory} color={accent.text} />
            </div>

          </div>
        </div>

        {/* Franja de posición inferior */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent.via}, ${accent.from})` }} />
      </div>

      {orderDialogSide != null && quote != null && (
        <OrderConfirmDialog
          side={orderDialogSide}
          playerName={player.name}
          price={quote.value}
          isSubmitting={isSubmittingOrder}
          error={orderError}
          onConfirm={(quantity) => void handleConfirmOrder(quantity)}
          onCancel={() => setOrderDialogSide(null)}
        />
      )}
    </div>
  );
};