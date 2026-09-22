import { useState } from 'react';
import { authService } from '../service/authService';
import { apiKeyStorage } from '../service/apiKeyStorage';
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
  const [hasActiveKey, setHasActiveKey] = useState<boolean>(() =>
    Boolean(apiKeyStorage.getApiKey()),
  );

  const executeGeneration = async () => {
    setPanelState({ phase: 'generating' });
    try {
      const data = await authService.generateApiKey();
      apiKeyStorage.setApiKey(data.apiKey);
      setHasActiveKey(true);
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
      executeGeneration();
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto py-4">
      <title>Mi cuenta — Football Market</title>

      {/* Header Sección */}
      <div className="bg-[#0d2b1e] border-2 border-[#ff6b00]/30 p-6 sm:p-8 rounded-2xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-8 border-l-[#ff6b00]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#34d399]">
              GESTIÓN DE CUENTA & SEGURIDAD
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
                ? 'bg-[#10b981]/20 text-[#34d399] border-[#10b981]/40'
                : 'bg-[#ff6b00]/20 text-[#ff6b00] border-[#ff6b00]/40'
            }`}
          >
            {hasActiveKey ? '● Clave Activa' : '○ Sin Clave Emitida'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Panel Principal: Emisión de ApiKey */}
        <div className="lg:col-span-8 bg-[#0d2b1e] border border-[#123828] hover:border-[#ff6b00]/50 rounded-2xl shadow-2xl flex flex-col justify-between relative overflow-hidden group transition-all">
          <div className="h-2 bg-gradient-to-r from-[#ff6b00] via-[#10b981] to-[#ff6b00]" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-[#071a12] text-[#ff6b00] border border-[#ff6b00]/40 text-[10px] font-black uppercase tracking-widest rounded-md">
                CLAVE PERSONAL (APIKEY)
              </span>
            </div>

            <h2 className="text-2xl font-black uppercase tracking-wider text-white mb-3">
              Generar Clave de Acceso (ApiKey)
            </h2>

            <p className="text-sm font-medium text-gray-300 leading-relaxed mb-6">
              Solicitá tu clave de acceso personal para operar de manera segura en la aplicación. Esta clave te permite autenticarte y realizar operaciones autorizadas en tu cuenta.
            </p>

            <div className="bg-[#071a12] border-l-4 border-[#ff6b00] p-4 rounded-xl mb-6 space-y-1.5 shadow-inner border border-[#123828]">
              <div className="text-[11px] font-black uppercase tracking-wider text-[#ff6b00] flex items-center gap-2">
                <span>🛡️ CONDICIÓN DE USO</span>
              </div>
              <p className="text-xs text-gray-300 font-medium leading-relaxed">
                Cada usuario puede tener como máximo <strong className="text-white">una clave activa a la vez</strong>. Si solicitás una nueva clave, la anterior quedará <span className="text-[#ff6b00] font-black">invalidada inmediatamente</span> por razones de seguridad.
              </p>
            </div>

            {panelState.phase === 'error' && (
              <div
                role="alert"
                className="mb-6 p-4 bg-[#ea580c]/20 border-l-4 border-[#ea580c] text-white text-xs font-black uppercase tracking-wider rounded-md"
              >
                {panelState.message}
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 bg-[#071a12] border-t border-[#123828] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Generación Instantánea & Segura
            </div>

            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={panelState.phase === 'generating'}
              className="px-8 py-3.5 bg-[#ff6b00] hover:bg-[#e05e00] text-white font-black uppercase tracking-widest text-xs shadow-xl hover:shadow-[#ff6b00]/40 transition-all rounded-xl border border-white/20 disabled:opacity-50 active:scale-95 text-center cursor-pointer"
            >
              {panelState.phase === 'generating' ? 'Generando…' : 'Generar ApiKey'}
            </button>
          </div>
        </div>

        {/* Panel Secundario: Recomendaciones de Uso */}
        <div className="lg:col-span-4 bg-[#0d2b1e] border border-[#123828] rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-[#ff6b00]/50 transition-all">
          <div className="h-2 bg-gradient-to-r from-[#10b981] via-[#ff6b00] to-[#10b981]" />

          <div>
            <h3 className="text-lg font-black uppercase tracking-wider text-white mb-4">
              Recomendaciones de Seguridad
            </h3>

            <div className="space-y-4 text-xs font-medium text-gray-300">
              <div className="p-4 bg-[#071a12] border border-[#123828] rounded-xl">
                <span className="block font-black uppercase text-[#ff6b00] tracking-wider mb-1">
                  1. Copia por Única Vez
                </span>
                <span>Al generar la clave, copiála y guardála en un lugar seguro. No se podrá volver a consultar.</span>
              </div>

              <div className="p-4 bg-[#071a12] border border-[#123828] rounded-xl">
                <span className="block font-black uppercase text-[#ff6b00] tracking-wider mb-1">
                  2. Privacidad de la Clave
                </span>
                <span>No compartas tu clave con terceros. Es personal e intransferible.</span>
              </div>

              <div className="p-4 bg-[#071a12] border border-[#123828] rounded-xl">
                <span className="block font-black uppercase text-[#ff6b00] tracking-wider mb-1">
                  3. Renovación ante Pérdida
                </span>
                <span>Si perdés tu clave, podés volver a presionar Generar para reemplazarla por una nueva.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {panelState.phase === 'confirming' && (
        <ConfirmDialog
          onConfirm={executeGeneration}
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
