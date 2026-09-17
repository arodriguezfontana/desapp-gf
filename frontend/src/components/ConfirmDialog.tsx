interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white border-2 border-accent p-6 sm:p-8 shadow-2xl rounded-xs relative overflow-hidden">
        <div className="h-1.5 bg-accent absolute top-0 inset-x-0" />

        <div className="flex items-center gap-2.5 mb-3 pt-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
          <h2 className="text-xl font-black uppercase tracking-wider text-primary">
            ¿Generar nueva ApiKey?
          </h2>
        </div>

        <p className="text-xs sm:text-sm font-medium text-slate-700 leading-relaxed mb-6">
          Ya tenés una ApiKey activa. Si generás una nueva, la ApiKey anterior quedará invalidada inmediatamente y dejará de funcionar.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-widest border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all rounded-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest bg-accent hover:bg-accent-hover text-white shadow-md hover:shadow-lg transition-all rounded-xs active:scale-95"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
