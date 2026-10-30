import React, { useState } from 'react';
import type { AlertCondition } from '../types/alerts.types';

interface CreateAlertFormProps {
  playerId: string;
  onCreate: (playerId: string, condition: AlertCondition, targetValue: number) => Promise<unknown>;
}

const CONDITION_OPTIONS: { value: AlertCondition; label: string }[] = [
  { value: 'PRICE_BELOW', label: 'Baja de' },
  { value: 'PRICE_ABOVE', label: 'Sube de' },
];

/** Formulario de creación de alerta sobre un jugador puntual (025-player-price-alerts, FR-001). */
export const CreateAlertForm: React.FC<CreateAlertFormProps> = ({ playerId, onCreate }) => {
  const [condition, setCondition] = useState<AlertCondition>('PRICE_BELOW');
  const [targetValue, setTargetValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const numericValue = Number(targetValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError('El valor umbral debe ser un número positivo.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(playerId, condition, numericValue);
      setTargetValue('');
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al crear la alerta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form aria-label="Crear alerta de precio" onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-[#1a6866] overflow-hidden shrink-0" role="radiogroup" aria-label="Condición">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={condition === opt.value}
              onClick={() => setCondition(opt.value)}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                condition === opt.value
                  ? 'bg-[#b79753] text-[#0b3332]'
                  : 'bg-[#0b3332] text-gray-300 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label htmlFor="alert-target-value" className="sr-only">
          Valor umbral
        </label>
        <input
          id="alert-target-value"
          type="number"
          step="0.01"
          placeholder="Valor"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          required
          className="w-28 bg-[#0b3332] text-white border border-[#1a6866] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#b79753]"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0b3332] bg-[#2dd4bf] hover:bg-[#20b8a5] rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'Creando...' : '+ Crear alerta'}
        </button>
      </div>

      {error && <p className="text-xs font-bold text-[#f43f5e]">{error}</p>}
      {success && <p className="text-xs font-bold text-[#2dd4bf]">Alerta creada.</p>}
    </form>
  );
};
