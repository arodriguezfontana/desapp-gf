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
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white border-2 border-primary p-6 sm:p-8 shadow-2xl rounded-xs relative overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-secondary absolute top-0 inset-x-0" />

        <div className="flex items-center justify-between mb-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <h2 className="text-xl font-black uppercase tracking-wider text-primary">
              Tu ApiKey
            </h2>
          </div>
        </div>

        <div className="mb-6 p-4 bg-orange-50 border-l-4 border-accent text-accent font-black text-xs uppercase tracking-wider shadow-sm">
          Guardá esta clave ahora. No podrás volver a consultarla.
        </div>

        <div className="mb-6">
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-700 mb-1.5">
            Clave de Acceso
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={apiKey}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 text-slate-900 font-mono text-xs select-all focus:outline-none rounded-xs shadow-inner"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-5 py-3 text-xs font-black uppercase tracking-widest bg-accent hover:bg-accent-hover text-white shadow-md transition-all whitespace-nowrap rounded-xs active:scale-95"
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary-bright text-white transition-all rounded-xs shadow-md"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
