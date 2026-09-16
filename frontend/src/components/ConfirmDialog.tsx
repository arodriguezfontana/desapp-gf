interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="w-full max-w-md bg-white border-2 border-primary p-6 shadow-xl">
        <h2 className="text-xl font-black uppercase tracking-wider text-primary mb-3">
          ¿Generar nueva ApiKey?
        </h2>
        <p className="text-sm text-foreground/80 font-medium mb-6">
          Ya tenés una ApiKey activa. Si generás una nueva, la ApiKey anterior quedará invalidada inmediatamente y dejará de funcionar.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 border-secondary text-foreground hover:bg-secondary/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

