import React from 'react';
import { Link } from 'react-router-dom';
import { getPositionLabel, type Player, type PlayerQuote } from '../types/catalog.types';

interface PlayerCardProps {
  player: Player;
  quote?: PlayerQuote | null;
}

/** Colores de acento metálico por posición — estética FIFA */
const POSITION_ACCENT: Record<string, { from: string; via: string; text: string; badge: string }> = {
  GK: { from: '#e6c875', via: '#b79753', text: '#b79753', badge: 'bg-[#b79753]/20 text-[#b79753] border-[#b79753]/50' },
  DF: { from: '#60a5fa', via: '#1d4ed8', text: '#60a5fa', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  MF: { from: '#5eead4', via: '#0d9488', text: '#2dd4bf', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  FW: { from: '#d8b4fe', via: '#7c3aed', text: '#c084fc', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
};

const getAccent = (pos: string) =>
  POSITION_ACCENT[pos] ?? { from: '#e6c875', via: '#b79753', text: '#b79753', badge: 'bg-slate-700 text-slate-300 border-slate-600' };

const getPositionColorClass = (pos: string) => {
  switch (pos) {
    case 'GK':
      return 'text-[#b79753]';
    case 'DF':
      return 'text-blue-400';
    case 'MF':
      return 'text-[#2dd4bf]';
    case 'FW':
      return 'text-purple-400';
    default:
      return 'text-slate-300';
  }
};

/** Silueta SVG por posición */
const POSITION_SILHOUETTE: Record<string, string> = {
  GK: '/assets/player_silhouette_gk.svg',
  DF: '/assets/player_silhouette_df.svg',
  MF: '/assets/player_silhouette_mf.svg',
  FW: '/assets/player_silhouette_fw.svg',
};
const getSilhouette = (pos: string) =>
  POSITION_SILHOUETTE[pos] ?? '/assets/player_silhouette_mf.svg';

/** Stat pill compacto estilo FIFA */
const StatPill: React.FC<{ value: number | null | undefined; label: string; color: string }> = ({
  value, label, color,
}) => (
  <div className="flex flex-col items-center justify-center py-1">
    <span className="text-sm font-black tabular-nums leading-none" style={{ color }}>
      {value ?? '—'}
    </span>
    <span className="text-[8px] font-bold uppercase tracking-widest text-white/50 mt-1">{label}</span>
  </div>
);

// Geometría del escudo FIFA (recorte superior biselado + punta inferior)
const FIFA_SHIELD_CLIP = 'polygon(5% 0, 95% 0, 100% 3.5%, 100% calc(100% - 24px), 50% 100%, 0 calc(100% - 24px), 0 3.5%)';

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, quote }) => {
  const accent = getAccent(player.position);
  const displayValue = quote != null ? Math.round(quote.value) : null;

  return (
    <div
      className="relative group transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02]"
      style={{ filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.65))' }}
    >
      {/* ── Borde exterior metálico con forma de escudo FIFA ── */}
      <div
        className="p-[2.5px] transition-all duration-500 group-hover:p-[3px]"
        style={{
          clipPath: FIFA_SHIELD_CLIP,
          background: `linear-gradient(145deg, ${accent.from}, ${accent.via} 35%, rgba(255,255,255,0.6) 50%, ${accent.from} 65%, ${accent.via} 100%)`,
        }}
      >
        {/* ── Cuerpo interior de la carta FIFA ── */}
        <div
          className="relative overflow-hidden flex flex-col justify-between"
          style={{
            clipPath: FIFA_SHIELD_CLIP,
            background: 'linear-gradient(175deg, #10403f 0%, #082625 45%, #041615 100%)',
            minHeight: '420px',
          }}
        >
          {/* Brillo holográfico que cruza la carta periódicamente */}
          <div
            className="fifa-card-shine pointer-events-none absolute inset-y-0 w-32 -left-24 bg-gradient-to-r from-transparent via-white/20 to-transparent z-30"
            style={{ mixBlendMode: 'overlay' }}
          />

          {/* Destello de fondo detrás de la silueta */}
          <div
            className="absolute inset-0 opacity-20 blur-2xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 45%, ${accent.from} 0%, transparent 65%)`,
            }}
          />

          {/* ── Cabecera superior: OVR + Posición a la izquierda, Escudo a la derecha ── */}
          <div className="relative z-10 pt-4 px-4 flex items-start justify-between">
            {/* OVR + Posición + Liga estilo FIFA */}
            <div className="flex flex-col items-start leading-none">
              <span
                className="text-4xl font-black tabular-nums tracking-tighter drop-shadow-md"
                style={{ color: accent.from }}
              >
                {displayValue ?? '—'}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${getPositionColorClass(
                  player.position,
                )}`}
              >
                {getPositionLabel(player.position)}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/50 mt-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                {player.league}
              </span>
            </div>

            {/* Escudo del club (o emoji pelota ⚽ si no hay escudo) */}
            <div className="w-11 h-11 rounded-full bg-[#0b3332]/80 border border-[#b79753]/40 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
              {player.crestUrl ? (
                <img
                  src={player.crestUrl}
                  alt={player.team}
                  className="w-8 h-8 object-contain drop-shadow"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    (e.currentTarget.parentElement as HTMLElement).textContent = '⚽';
                  }}
                />
              ) : (
                <span className="text-xl select-none">⚽</span>
              )}
            </div>
          </div>

          {/* ── Centro: Silueta del jugador ── */}
          <div className="relative z-0 flex justify-center -mt-6 pb-0">
            <img
              src={getSilhouette(player.position)}
              alt="Jugador"
              className="h-44 object-contain select-none pointer-events-none drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
              draggable={false}
            />
          </div>

          {/* ── Separador de cinta dorada y Nombre del jugador ── */}
          <div className="relative z-10 px-4 text-center">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/20" />
              <div className="w-1.5 h-1.5 rotate-45 shrink-0" style={{ backgroundColor: accent.from }} />
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/20" />
            </div>

            <h3 className="text-base font-black uppercase tracking-wider text-white leading-tight drop-shadow line-clamp-1 group-hover:text-[#b79753] transition-colors">
              {player.name}
            </h3>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mt-0.5 line-clamp-1">
              {player.team}
            </p>
          </div>

          {/* ── Grilla de estadísticas FIFA ── */}
          <div
            className="mx-4 my-2 rounded-xl py-1.5 px-2.5 grid grid-cols-3 gap-1 border border-white/10"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          >
            <StatPill value={player.goals} label="Goles" color="#2dd4bf" />
            <StatPill value={player.assists} label="Asis." color="#b79753" />
            <StatPill value={player.yellowCards} label="TA" color="#facc15" />
          </div>

          {/* ── Pie con forma de punta de escudo: Botón 'Ver detalle' ── */}
          <div className="pb-7 pt-1 text-center relative z-10">
            <Link
              to={`/catalog/${player.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-[#0b3332] transition-all hover:scale-105 shadow-md active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.via})`,
              }}
            >
              <span>Ver detalle</span>
              <span className="text-xs">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
