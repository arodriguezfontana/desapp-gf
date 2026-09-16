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
    <div className="space-y-6">
      <title>Mi cuenta — DesApp</title>

      <div className="bg-white border-2 border-primary p-6 shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-wider text-primary mb-4">
          Configuración de Cuenta
        </h1>

        <div className="border border-foreground/20 p-4 bg-background">
          <h2 className="text-lg font-black uppercase text-foreground mb-2">
            Gestión de ApiKey
          </h2>
          <p className="text-sm text-foreground/80 mb-4">
            Generá una ApiKey para integrar servicios externos con tu cuenta. Recordá que solo podés tener una ApiKey activa a la vez.
          </p>

          {panelState.phase === 'error' && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-600 text-red-600 text-sm font-semibold"
            >
              {panelState.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={panelState.phase === 'generating'}
            className="bg-accent text-white px-5 py-2.5 font-black uppercase tracking-wider hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {panelState.phase === 'generating' ? 'Generando…' : 'Generar ApiKey'}
          </button>
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
