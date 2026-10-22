import React, { useEffect, useState, useCallback } from 'react';
import { useUserStrategies } from '../hooks/useUserStrategies';
import { POSITIONS, getPositionLabel } from '../types/catalog.types';
import type { Position } from '../types/catalog.types';
import type { UserStrategyResponseDto } from '../types/userStrategy.types';

function sumOf(weights: Record<string, number>): number {
  return Object.values(weights).reduce((acc, w) => acc + w, 0);
}

const WeightsForm: React.FC<{
  title: string;
  weights: Record<string, number>;
  isSaving: boolean;
  onSave: (weights: Record<string, number>) => Promise<void>;
}> = ({ title, weights, isSaving, onSave }) => {
  // `weights` solo cambia cuando el padre recarga la estrategia tras un guardado
  // exitoso; en ese momento conviene que el draft arranque de cero otra vez.
  // En vez de sincronizar con un efecto, el padre fuerza el remount con `key`.
  const [draft, setDraft] = useState<Record<string, number>>(weights);
  const [error, setError] = useState<string | null>(null);

  const sum = sumOf(draft);
  const isValid = Math.abs(sum - 1.0) <= 0.001;

  const handleChange = (key: string, value: string) => {
    const parsed = Number.parseFloat(value);
    setDraft((prev) => ({ ...prev, [key]: Number.isNaN(parsed) ? 0 : parsed }));
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      await onSave(draft);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los pesos.');
    }
  };

  return (
    <div className="bg-[#0b3332] p-4 rounded-xl border border-[#1a6866] space-y-3">
      <h4 className="text-xs font-black uppercase tracking-wider text-white">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(draft).map(([key, value]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{key}</span>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              className="bg-[#104443] border border-[#1a6866] text-white text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#b79753]"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-wider ${isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
          Suma: {sum.toFixed(3)} {isValid ? '✓' : '(debe ser 1.0 ±0.001)'}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSaving}
          className="px-4 py-1.5 bg-[#b79753] hover:bg-[#9e8144] disabled:opacity-40 text-[#0b3332] font-black uppercase text-[10px] tracking-widest rounded-lg transition-all cursor-pointer"
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      {error && <p className="text-[10px] font-bold text-rose-400">{error}</p>}
    </div>
  );
};

const StrategyCard: React.FC<{
  strategy: UserStrategyResponseDto;
  isSelecting: boolean;
  savingKey: string | null;
  onSelect: () => void;
  onSaveWeights: (weights: Record<string, number>) => Promise<void>;
  onSavePositionWeights: (position: Position, weights: Record<string, number>) => Promise<void>;
}> = ({ strategy, isSelecting, savingKey, onSelect, onSaveWeights, onSavePositionWeights }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl p-4 border space-y-4 ${
        strategy.isSelected ? 'bg-[#0b3332] border-[#2dd4bf]/60' : 'bg-[#0b3332]/50 border-[#1a6866]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-wider text-white">{strategy.name}</h3>
        {strategy.isSelected ? (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded">
            Seleccionada
          </span>
        ) : (
          <button
            onClick={onSelect}
            disabled={isSelecting}
            className="shrink-0 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#b79753] border border-[#b79753]/50 hover:bg-[#b79753]/10 disabled:opacity-40 rounded-lg transition-all cursor-pointer"
          >
            {isSelecting ? 'Seleccionando...' : 'Usar esta estrategia'}
          </button>
        )}
      </div>

      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        {expanded ? '▲ Ocultar edición de pesos' : '▼ Editar pesos'}
      </button>

      {expanded && (
        <div className="space-y-3">
          <WeightsForm
            key={JSON.stringify(strategy.weights)}
            title="Pesos generales"
            weights={strategy.weights}
            isSaving={savingKey === 'general'}
            onSave={onSaveWeights}
          />
          {POSITIONS.map((position) =>
            strategy.positionWeights[position] ? (
              <WeightsForm
                key={`${position}-${JSON.stringify(strategy.positionWeights[position])}`}
                title={`Perfil ${getPositionLabel(position)}`}
                weights={strategy.positionWeights[position]!}
                isSaving={savingKey === position}
                onSave={(weights) => onSavePositionWeights(position, weights)}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
};

export const MyStrategiesPage: React.FC = () => {
  const { listStrategies, selectStrategy, editWeights, editPositionWeights } = useUserStrategies();

  const [strategies, setStrategies] = useState<UserStrategyResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<{ strategyId: string; key: string } | null>(null);

  const loadStrategies = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listStrategies();
      setStrategies(data.strategies);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar tus estrategias.');
    } finally {
      setIsLoading(false);
    }
  }, [listStrategies]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) await loadStrategies();
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [loadStrategies]);

  const handleSelect = async (strategyId: string) => {
    setSelectingId(strategyId);
    try {
      await selectStrategy(strategyId);
      await loadStrategies();
    } finally {
      setSelectingId(null);
    }
  };

  const handleSaveWeights = async (strategyId: string, weights: Record<string, number>) => {
    setSavingKey({ strategyId, key: 'general' });
    try {
      await editWeights(strategyId, weights);
      await loadStrategies();
    } finally {
      setSavingKey(null);
    }
  };

  const handleSavePositionWeights = async (
    strategyId: string,
    position: Position,
    weights: Record<string, number>,
  ) => {
    setSavingKey({ strategyId, key: position });
    try {
      await editPositionWeights(strategyId, position, weights);
      await loadStrategies();
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      <title>Mis Estrategias — FútVal</title>

      <div className="bg-[#104443] border border-[#1a6866] p-6 sm:p-8 rounded-2xl shadow-xl border-l-8 border-l-[#b79753]">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white leading-none">
          Mis estrategias
        </h1>
        <p className="text-xs sm:text-sm text-gray-300 font-medium mt-2 max-w-2xl">
          Tenés exactamente dos estrategias de valuación propias. Elegí cuál usar y ajustá sus pesos a tu
          criterio; el recálculo de cotizaciones es una operación de sistema que ejecuta el administrador.
        </p>
      </div>

      <div className="bg-[#104443] border border-[#1a6866] rounded-2xl shadow-xl p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-black uppercase tracking-wider text-white">Mis dos estrategias</h2>

        {loadError && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-xl font-bold">
            {loadError}
          </div>
        )}

        {isLoading ? (
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cargando estrategias...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                isSelecting={selectingId === strategy.id}
                savingKey={savingKey?.strategyId === strategy.id ? savingKey.key : null}
                onSelect={() => handleSelect(strategy.id)}
                onSaveWeights={(weights) => handleSaveWeights(strategy.id, weights)}
                onSavePositionWeights={(position, weights) =>
                  handleSavePositionWeights(strategy.id, position, weights)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
