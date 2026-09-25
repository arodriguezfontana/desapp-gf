import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCatalog, ApiError } from '../hooks/useCatalog';
import { useApiKey } from '../hooks/useApiKey';
import { getPositionLabel, type Player } from '../types/catalog.types';

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

    Promise.resolve().then(() => {
      if (isMounted) {
        void fetchDetail();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasApiKey, id, getPlayerById]);

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
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <title>{player ? `${player.name} — FútVal` : 'Detalle de Jugador — FútVal'}</title>

      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#b79753] hover:text-white mb-6 transition-colors"
      >
        &larr; Volver al catálogo
      </Link>

      {isLoading ? (
        <div className="bg-[#104443] rounded-2xl p-12 border border-[#1a6866] text-center shadow-2xl">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1a6866] border-t-[#b79753] mb-4"></div>
          <p className="text-xs font-black uppercase tracking-wider text-[#b79753]">
            Cargando ficha del jugador...
          </p>
        </div>
      ) : errorMessage ? (
        <div className="bg-[#104443] border-2 border-[#f43f5e] rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/40 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">Información de Jugador</h2>
          <p className="text-sm font-bold text-gray-200">{errorMessage}</p>
        </div>
      ) : player ? (
        <div className="bg-[#104443] rounded-2xl border border-[#b79753]/30 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#0b3332] via-[#104443] to-[#0b3332] p-8 text-white border-b border-[#1a6866]">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="bg-[#b79753] text-[#0b3332] font-black text-xs px-3.5 py-1 rounded-md uppercase tracking-widest">
                {getPositionLabel(player.position)}
              </span>
              <span className="bg-[#0b3332] text-[#b79753] font-bold text-xs px-3.5 py-1 rounded-md border border-[#b79753]/30">
                {player.league}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-wider uppercase mb-2">
              {player.name}
            </h1>

            <p className="text-[#b79753] font-bold text-lg flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#b79753] inline-block"></span>
              {player.team}
            </p>
          </div>

          <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 bg-[#0b3332]/60">
            <div className="bg-[#0b3332] p-5 rounded-xl border border-[#1a6866] shadow-md">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-1">
                Competencia
              </span>
              <span className="text-base font-black text-white">{player.league}</span>
            </div>

            <div className="bg-[#0b3332] p-5 rounded-xl border border-[#1a6866] shadow-md">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-1">
                Club Actual
              </span>
              <span className="text-base font-black text-[#b79753]">{player.team}</span>
            </div>

            <div className="bg-[#0b3332] p-5 rounded-xl border border-[#1a6866] shadow-md">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#b79753] mb-1">
                Posición
              </span>
              <span className="text-base font-black text-white">{getPositionLabel(player.position)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
