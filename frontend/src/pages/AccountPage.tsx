import { useState } from 'react';
import { authService } from '../service/authService';
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
  const [hasActiveKey, setHasActiveKey] = useState(false);

  const executeGeneration = async () => {
    setPanelState({ phase: 'generating' });
    try {
      const data = await authService.generateApiKey();
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
    <div className="space-y-8 animate-fade-in">
      <title>Mi cuenta — DesApp Fútbol</title>

      {/* Header Sección */}
      <div className="bg-white border-2 border-primary/20 p-6 sm:p-8 rounded-xs shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-8 border-l-primary">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
              GESTIÓN DE CUENTA
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-primary leading-none">
            Configuración de Cuenta
          </h1>
        </div>

        <div>
          <span className={`px-4 py-2 border text-xs font-black uppercase tracking-widest rounded-xs shadow-sm ${
            hasActiveKey
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-orange-50 text-accent border-orange-300'
          }`}>
            {hasActiveKey ? '● Clave Activa' : '○ Sin Clave Emitida'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Panel Principal: Emisión de ApiKey */}
        <div className="lg:col-span-8 bg-white border-2 border-primary/20 rounded-xs shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-primary transition-all">
          <div className="h-2 bg-gradient-to-r from-primary via-accent to-secondary" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-primary text-white border border-primary text-[10px] font-black uppercase tracking-widest rounded-xs">
                CLAVE PERSONAL
              </span>
            </div>

            <h2 className="text-2xl font-black uppercase tracking-widest text-primary mb-3">
              Generar Clave de Acceso (ApiKey)
            </h2>

            <p className="text-sm font-medium text-slate-700 leading-relaxed mb-6">
              Solicitá tu clave de acceso personal para operar de manera segura en la aplicación. Esta clave te permite autenticarte y realizar operaciones autorizadas en tu cuenta.
            </p>

            <div className="bg-slate-50 border-l-4 border-accent p-4 rounded-xs mb-6 space-y-1.5 shadow-inner">
              <div className="text-[11px] font-black uppercase tracking-wider text-accent flex items-center gap-2">
                <span>🛡️ CONDICIÓN DE USO</span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Cada usuario puede tener como máximo <strong className="text-slate-900">una clave activa a la vez</strong>. Si solicitás una nueva clave, la anterior quedará <span className="text-accent font-black">invalidada inmediatamente</span> por razones de seguridad.
              </p>
            </div>

            {panelState.phase === 'error' && (
              <div
                role="alert"
                className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-700 text-xs font-black uppercase tracking-wider"
              >
                {panelState.message}
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Generación Instantánea & Segura
            </div>

            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={panelState.phase === 'generating'}
              className="px-8 py-3.5 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-accent/30 transition-all rounded-xs disabled:opacity-50 active:scale-95 text-center"
            >
              {panelState.phase === 'generating' ? 'Generando…' : 'Generar ApiKey'}
            </button>
          </div>
        </div>

        {/* Panel Secundario: Recomendaciones de Uso */}
        <div className="lg:col-span-4 bg-white border-2 border-accent/30 rounded-xs shadow-xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-accent transition-all">
          <div className="h-2 bg-gradient-to-r from-accent via-primary to-accent" />

          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-primary mb-4">
              Recomendaciones de Seguridad
            </h3>

            <div className="space-y-4 text-xs font-medium text-slate-700">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xs">
                <span className="block font-black uppercase text-primary tracking-wider mb-1">
                  1. Copia por Única Vez
                </span>
                <span>Al generar la clave, copiála y guardála en un lugar seguro. No se podrá volver a consultar.</span>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xs">
                <span className="block font-black uppercase text-primary tracking-wider mb-1">
                  2. Privacidad de la Clave
                </span>
                <span>No compartas tu clave con terceros. Es personal e intransferible.</span>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xs">
                <span className="block font-black uppercase text-primary tracking-wider mb-1">
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
