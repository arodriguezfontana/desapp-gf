interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b3332]/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#104443] border-2 border-[#b79753] p-6 sm:p-8 shadow-2xl rounded-2xl relative overflow-hidden text-white">
        <div className="h-1.5 bg-[#b79753] absolute top-0 inset-x-0" />

        <div className="flex items-center gap-2.5 mb-3 pt-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#b79753] animate-ping" />
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            ¿Generar nueva ApiKey?
          </h2>
        </div>

        <p className="text-xs sm:text-sm font-medium text-gray-300 leading-relaxed mb-6">
          Ya tenés una ApiKey activa. Si generás una nueva, la ApiKey anterior quedará invalidada inmediatamente y dejará de funcionar.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#1a6866]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-widest border border-[#1a6866] text-gray-300 hover:bg-[#1a6866] transition-all rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest bg-[#b79753] hover:bg-[#9e8144] text-[#0b3332] shadow-lg transition-all rounded-xl cursor-pointer border border-white/20 active:scale-95"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
