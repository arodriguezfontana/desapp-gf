import { useState } from 'react';

interface ApiKeyModalProps {
  apiKey: string;
  createdAt: string;
  onClose: () => void;
}

export function ApiKeyModal({ apiKey, onClose }: ApiKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback si clipboard falla
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="w-full max-w-lg bg-white border-2 border-primary p-6 shadow-xl">
        <h2 className="text-xl font-black uppercase tracking-wider text-primary mb-3">
          Tu ApiKey
        </h2>

        <div className="mb-4 p-3 bg-accent/10 border-l-4 border-accent text-foreground text-sm font-semibold">
          Guardá esta clave ahora. No podrás volver a consultarla.
        </div>

        <div className="mb-6 flex gap-2">
          <input
            type="text"
            readOnly
            value={apiKey}
            className="w-full p-2 border border-foreground/30 bg-background font-mono text-sm select-all focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-primary text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold uppercase tracking-wider border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

