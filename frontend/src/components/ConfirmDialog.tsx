interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a12]/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#0d2b1e] border-2 border-[#ff6b00] p-6 sm:p-8 shadow-2xl rounded-2xl relative overflow-hidden text-white">
        <div className="h-1.5 bg-[#ff6b00] absolute top-0 inset-x-0" />

        <div className="flex items-center gap-2.5 mb-3 pt-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b00] animate-ping" />
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            ¿Generar nueva ApiKey?
          </h2>
        </div>

        <p className="text-xs sm:text-sm font-medium text-gray-300 leading-relaxed mb-6">
          Ya tenés una ApiKey activa. Si generás una nueva, la ApiKey anterior quedará invalidada inmediatamente y dejará de funcionar.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#123828]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-widest border border-[#123828] text-gray-300 hover:bg-[#123828] transition-all rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest bg-[#ff6b00] hover:bg-[#e05e00] text-white shadow-lg transition-all rounded-xl cursor-pointer border border-white/20 active:scale-95"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
