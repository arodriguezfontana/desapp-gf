import { useState } from 'react';
import { useAuthActions } from '../hooks/useAuthActions';
import { useApiKey } from '../hooks/useApiKey';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ApiKeyModal } from '../components/ApiKeyModal';
import type { IssueApiKeyResponseDto } from '../types/auth.types';

type ApiKeyPanelState =
  | { phase: 'idle' }
  | { phase: 'confirming' }
  | { phase: 'generating' }
  | { phase: 'revealed'; data: IssueApiKeyResponseDto }
  | { phase: 'error'; message: string };

export function AccountPage() {
  const [panelState, setPanelState] = useState<ApiKeyPanelState>({ phase: 'idle' });
  const { generateApiKey } = useAuthActions();
  const { hasApiKey: hasActiveKey, saveApiKey } = useApiKey();

  const executeGeneration = async () => {
    setPanelState({ phase: 'generating' });
    try {
      const data = await generateApiKey();
      saveApiKey(data.apiKey);
      setPanelState({ phase: 'revealed', data });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPanelState({ phase: 'error', message: err.message });
      } else {
        setPanelState({ phase: 'error', message: 'Error al generar la ApiKey.' });
      }
    }
  };

  const handleGenerateClick = () => {
    if (hasActiveKey) {
      setPanelState({ phase: 'confirming' });
    } else {
      void executeGeneration();
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <title>Mi cuenta — FútVal</title>

      {/* Header Sección */}
      <div className="bg-[#104443] border-2 border-[#b79753]/30 p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-8 border-l-[#b79753]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#b79753] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#b79753]">
              MI CUENTA & SEGURIDAD
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-white leading-none">
            Configuración de Cuenta
          </h1>
        </div>

        <div>
          <span
            className={`px-4 py-2 border text-xs font-black uppercase tracking-widest rounded-xl shadow-md ${
              hasActiveKey
                ? 'bg-[#b79753]/20 text-[#b79753] border-[#b79753]/40'
                : 'bg-[#f43f5e]/20 text-[#f43f5e] border-[#f43f5e]/40'
            }`}
          >
            {hasActiveKey ? '● Clave Activa' : '○ Sin Clave Emitida'}
          </span>
        </div>
      </div>

      <div className="space-y-8">
        {/* Panel Principal: Emisión de ApiKey */}
        <div className="bg-[#104443] border border-[#1a6866] hover:border-[#b79753]/50 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden group transition-all">
          <div className="relative h-48 sm:h-64 overflow-hidden border-b border-[#1a6866]">
            <img
              src="/assets/account_security.jpg"
              alt="Seguridad y Emisión de Clave"
              className="w-full h-full object-cover object-[center_35%] filter brightness-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#104443] via-[#104443]/30 to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest text-[#b79753] bg-[#0b3332]/90 backdrop-blur-md px-3 py-1 rounded-md border border-[#b79753]/40">
              CLAVE PERSONAL (APIKEY)
            </span>
          </div>

          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-white mb-3">
                Generar Clave de Acceso (ApiKey)
              </h2>

              <p className="text-sm font-medium text-gray-300 leading-relaxed mb-6">
                Solicitá tu clave de acceso personal para ingresar al catálogo completo y consultar estadísticas detalladas de futbolistas de manera segura.
              </p>

              <div className="bg-[#0b3332] border-l-4 border-[#b79753] p-4 rounded-xl mb-6 space-y-1.5 shadow-inner border border-[#1a6866]">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#b79753] flex items-center gap-2">
                  <span>CONDICIÓN DE USO</span>
                </div>
                <p className="text-xs text-gray-300 font-medium leading-relaxed">
                  Cada usuario puede tener como máximo <strong className="text-white">una clave activa a la vez</strong>. Si solicitás una nueva clave, la anterior quedará <span className="text-[#b79753] font-black">invalidada inmediatamente</span> por razones de seguridad.
                </p>
              </div>

              {panelState.phase === 'error' && (
                <div
                  role="alert"
                  className="mb-6 p-4 bg-[#f43f5e]/20 border-l-4 border-[#f43f5e] text-white text-xs font-black uppercase tracking-wider rounded-md"
                >
                  {panelState.message}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-[#1a6866] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Generación Instantánea & Segura
              </div>

              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={panelState.phase === 'generating'}
                className="px-8 py-3.5 bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] font-black uppercase tracking-widest text-xs shadow-xl hover:shadow-[#b79753]/40 transition-all rounded-xl border border-white/20 disabled:opacity-50 active:scale-95 text-center cursor-pointer"
              >
                {panelState.phase === 'generating' ? 'Generando…' : 'Generar ApiKey'}
              </button>
            </div>
          </div>
        </div>

        {/* Panel Secundario: Recomendaciones de Uso (con el mismo ancho del panel principal) */}
        <div className="bg-[#104443] border border-[#1a6866] rounded-2xl shadow-xl overflow-hidden relative group hover:border-[#b79753]/50 transition-all p-6 sm:p-8">
          <div className="h-1.5 bg-gradient-to-r from-[#b79753] via-[#1a6866] to-[#b79753] -mt-6 -mx-6 sm:-mt-8 sm:-mx-8 mb-6" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 bg-[#0b3332] text-[#b79753] border border-[#b79753]/40 text-[10px] font-black uppercase tracking-widest rounded-md">
                SEGURIDAD & PRIVACIDAD
              </span>
            </div>

            <h3 className="text-xl font-black uppercase tracking-wider text-white mb-2">
              Recomendaciones de Seguridad
            </h3>
            <p className="text-xs text-gray-300 font-medium mb-6">
              Tené en cuenta estas prácticas esenciales para proteger tu cuenta y tu clave de acceso.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-gray-300">
              <div className="p-5 bg-[#0b3332] border border-[#1a6866] rounded-xl flex flex-col justify-between">
                <div>
                  <span className="block font-black uppercase text-[#b79753] tracking-wider mb-2">
                    1. Copia por Única Vez
                  </span>
                  <span className="text-gray-300 leading-relaxed">
                    Al generar la clave, copiála y guardála en un lugar seguro. Por motivos de privacidad no se podrá volver a consultar.
                  </span>
                </div>
              </div>

              <div className="p-5 bg-[#0b3332] border border-[#1a6866] rounded-xl flex flex-col justify-between">
                <div>
                  <span className="block font-black uppercase text-[#b79753] tracking-wider mb-2">
                    2. Privacidad de la Clave
                  </span>
                  <span className="text-gray-300 leading-relaxed">
                    No compartas tu clave con terceros. Es personal, intransferible y está asociada a tus consultas en el sistema.
                  </span>
                </div>
              </div>

              <div className="p-5 bg-[#0b3332] border border-[#1a6866] rounded-xl flex flex-col justify-between">
                <div>
                  <span className="block font-black uppercase text-[#b79753] tracking-wider mb-2">
                    3. Renovación ante Pérdida
                  </span>
                  <span className="text-gray-300 leading-relaxed">
                    Si perdés tu clave, podés volver a presionar Generar para reemplazarla por una nueva e invalidar la anterior.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {panelState.phase === 'confirming' && (
        <ConfirmDialog
          onConfirm={() => void executeGeneration()}
          onCancel={() => setPanelState({ phase: 'idle' })}
        />
      )}

      {panelState.phase === 'revealed' && (
        <ApiKeyModal
          apiKey={panelState.data.apiKey}
          createdAt={panelState.data.createdAt}
          onClose={() => setPanelState({ phase: 'idle' })}
        />
      )}
    </div>
  );
}
