import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { catalogService } from '../service/catalogService';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { httpEvents, ApiError } from '../service/httpClient';
import type { Player } from '../types/catalog.types';

export const PlayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => Boolean(apiKeyStorage.getApiKey()));
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleUnauthorizedKey = () => {
      setHasApiKey(false);
    };

    httpEvents.addEventListener('apiKeyUnauthorized', handleUnauthorizedKey);
    return () => {
      httpEvents.removeEventListener('apiKeyUnauthorized', handleUnauthorizedKey);
    };
  }, []);

  useEffect(() => {
    if (!hasApiKey || !id) return;

    let isMounted = true;

    const fetchDetail = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await catalogService.getPlayerById(id);
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
  }, [hasApiKey, id]);

  if (!hasApiKey) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border-2 border-amber-400/50 rounded-2xl p-8 text-center shadow-md">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🔑
          </div>
          <h2 className="text-2xl font-extrabold text-emerald-950 mb-3">
            Clave de Acceso Requerida
          </h2>
          <p className="text-base text-gray-700 font-medium mb-6">
            Necesitás generar una ApiKey para ver el catálogo.
          </p>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            Ir a Mi Cuenta para generar ApiKey &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900 hover:text-amber-600 mb-6 transition-colors"
      >
        &larr; Volver al catálogo
      </Link>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 border border-emerald-900/10 text-center shadow-sm">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-emerald-900 border-t-amber-500 mb-4"></div>
          <p className="text-sm font-semibold text-emerald-900">
            Cargando ficha del jugador...
          </p>
        </div>
      ) : errorMessage ? (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold text-red-950 mb-2">Información de Jugador</h2>
          <p className="text-base font-semibold text-red-800">{errorMessage}</p>
        </div>
      ) : player ? (
        <div className="bg-white rounded-2xl border border-emerald-900/15 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 p-8 text-white">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="bg-amber-500 text-emerald-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                {player.position}
              </span>
              <span className="bg-emerald-800/80 text-emerald-100 font-bold text-xs px-3 py-1 rounded-full border border-emerald-700">
                {player.league}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
              {player.name}
            </h1>

            <p className="text-amber-400 font-bold text-lg flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              {player.team}
            </p>
          </div>

          <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 bg-emerald-50/20">
            <div className="bg-white p-5 rounded-xl border border-emerald-900/10 shadow-sm">
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Competencia
              </span>
              <span className="text-base font-bold text-emerald-950">{player.league}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-emerald-900/10 shadow-sm">
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Club Actual
              </span>
              <span className="text-base font-bold text-amber-600">{player.team}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-emerald-900/10 shadow-sm">
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Posición
              </span>
              <span className="text-base font-bold text-emerald-950">{player.position}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

