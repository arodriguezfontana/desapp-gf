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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b3332]/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-[#104443] border-2 border-[#b79753] p-6 sm:p-8 shadow-2xl rounded-2xl relative overflow-hidden text-white">
        <div className="h-1.5 bg-gradient-to-r from-[#b79753] via-[#1a6866] to-[#b79753] absolute top-0 inset-x-0" />

        <div className="flex items-center justify-between mb-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#b79753] animate-pulse" />
            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              Tu ApiKey
            </h2>
          </div>
        </div>

        <div className="mb-6 p-4 bg-[#b79753]/20 border-l-4 border-[#b79753] text-[#b79753] font-black text-xs uppercase tracking-wider shadow-md rounded-lg">
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
              className="w-full px-4 py-3 bg-[#0b3332] border border-[#1a6866] text-white font-mono text-xs select-all focus:outline-none rounded-xl shadow-inner"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-5 py-3 text-xs font-black uppercase tracking-widest bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] shadow-md transition-all whitespace-nowrap rounded-xl active:scale-95 cursor-pointer border border-white/20"
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#1a6866]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest bg-[#1a6866] hover:bg-[#b79753] text-white hover:text-[#0b3332] transition-all rounded-xl shadow-md cursor-pointer border border-[#b79753]/30"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
