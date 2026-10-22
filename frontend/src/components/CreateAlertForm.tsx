import React, { useState } from 'react';
import type { AlertCondition } from '../types/alerts.types';

interface CreateAlertFormProps {
  playerId: string;
  onCreate: (playerId: string, condition: AlertCondition, targetValue: number) => Promise<unknown>;
}

/** Formulario de creación de alerta sobre un jugador puntual (025-player-price-alerts, FR-001). */
export const CreateAlertForm: React.FC<CreateAlertFormProps> = ({ playerId, onCreate }) => {
  const [condition, setCondition] = useState<AlertCondition>('PRICE_BELOW');
  const [targetValue, setTargetValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
    <form
      aria-label="Crear alerta de precio"
      onSubmit={handleSubmit}
      className="bg-[#104443] border border-[#1a6866] rounded-2xl p-6 space-y-4"
    >
      <h3 className="text-sm font-black uppercase tracking-wider text-white">Crear alerta de precio</h3>

      <div className="flex flex-col gap-2">
        <label htmlFor="alert-condition" className="text-xs font-bold uppercase tracking-wider text-gray-300">
          Condición
        </label>
        <select
          id="alert-condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as AlertCondition)}
          className="bg-[#0b3332] text-white border border-[#1a6866] rounded-xl px-3 py-2 text-sm"
        >
          <option value="PRICE_BELOW">El precio baja de</option>
          <option value="PRICE_ABOVE">El precio sube de</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="alert-target-value" className="text-xs font-bold uppercase tracking-wider text-gray-300">
          Valor umbral
        </label>
        <input
          id="alert-target-value"
          type="number"
          step="0.01"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          required
          className="bg-[#0b3332] text-white border border-[#1a6866] rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-xs font-bold text-[#f43f5e]">{error}</p>}
      {success && <p className="text-xs font-bold text-[#2dd4bf]">Alerta creada.</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[#0b3332] bg-[#b79753] hover:bg-[#9e8144] rounded-xl shadow-lg transition-all disabled:opacity-50"
      >
        {isSubmitting ? 'Creando...' : 'Crear alerta'}
      </button>
    </form>
  );
};
