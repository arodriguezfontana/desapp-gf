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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a12]/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-[#0d2b1e] border-2 border-[#10b981] p-6 sm:p-8 shadow-2xl rounded-2xl relative overflow-hidden text-white">
        <div className="h-1.5 bg-gradient-to-r from-[#10b981] via-[#ff6b00] to-[#10b981] absolute top-0 inset-x-0" />

        <div className="flex items-center justify-between mb-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              Tu ApiKey
            </h2>
          </div>
        </div>

        <div className="mb-6 p-4 bg-[#ff6b00]/20 border-l-4 border-[#ff6b00] text-[#ff6b00] font-black text-xs uppercase tracking-wider shadow-md rounded-lg">
          Guardá esta clave ahora. No podrás volver a consultarla.
        </div>

        <div className="mb-6">
          <label className="block text-[11px] font-black uppercase tracking-widest text-gray-300 mb-1.5">
            Clave de Acceso
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={apiKey}
              className="w-full px-4 py-3 bg-[#071a12] border border-[#123828] text-white font-mono text-xs select-all focus:outline-none rounded-xl shadow-inner"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-5 py-3 text-xs font-black uppercase tracking-widest bg-[#ff6b00] hover:bg-[#e05e00] text-white shadow-md transition-all whitespace-nowrap rounded-xl active:scale-95 cursor-pointer border border-white/20"
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#123828]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest bg-[#123828] hover:bg-[#10b981] text-white hover:text-[#071a12] transition-all rounded-xl shadow-md cursor-pointer border border-[#ff6b00]/30"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
