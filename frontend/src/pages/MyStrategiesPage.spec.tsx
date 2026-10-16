import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyStrategiesPage } from './MyStrategiesPage';
import * as useUserStrategiesModule from '../hooks/useUserStrategies';
import type { UserStrategyResponseDto } from '../types/userStrategy.types';

vi.mock('../hooks/useUserStrategies');

const PERFORMANCE: UserStrategyResponseDto = {
  id: 's-1',
  name: 'Performance general',
  weights: { goals: 0.5, assists: 0.5 },
  factorEscala: 99,
  isSelected: true,
  positionWeights: { GK: { rating: 1.0 } },
};

const TACTICAL: UserStrategyResponseDto = {
  id: 's-2',
  name: 'Impacto táctico',
  weights: { totalTackles: 1.0 },
  factorEscala: 99,
  isSelected: false,
  positionWeights: {},
};

describe('MyStrategiesPage', () => {
  const listStrategies = vi.fn();
  const selectStrategy = vi.fn();
  const editWeights = vi.fn();
  const editPositionWeights = vi.fn();
  const recalculate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    listStrategies.mockReset().mockResolvedValue({ strategies: [PERFORMANCE, TACTICAL] });
    selectStrategy.mockReset();
    editWeights.mockReset();
    editPositionWeights.mockReset();
    recalculate.mockReset();

    vi.spyOn(useUserStrategiesModule, 'useUserStrategies').mockReturnValue({
      listStrategies,
      selectStrategy,
      editWeights,
      editPositionWeights,
      recalculate,
    });
  });

  it('muestra el estado de carga y luego lista mis dos estrategias', async () => {
    render(<MyStrategiesPage />);

    expect(screen.getByText('Cargando estrategias...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Performance general')).toBeInTheDocument();
    });
    expect(screen.getByText('Impacto táctico')).toBeInTheDocument();
    expect(screen.getByText('Seleccionada')).toBeInTheDocument();
    expect(listStrategies).toHaveBeenCalledTimes(1);
  });

  it('muestra un error si falla la carga de estrategias', async () => {
    listStrategies.mockReset().mockRejectedValueOnce(new Error('No se pudo conectar'));

    render(<MyStrategiesPage />);

    await waitFor(() => {
      expect(screen.getByText('No se pudo conectar')).toBeInTheDocument();
    });
  });

  it('selecciona la estrategia no seleccionada y recarga la lista', async () => {
    selectStrategy.mockResolvedValueOnce({ ...TACTICAL, isSelected: true });
    listStrategies
      .mockResolvedValueOnce({ strategies: [PERFORMANCE, TACTICAL] })
      .mockResolvedValueOnce({ strategies: [{ ...PERFORMANCE, isSelected: false }, { ...TACTICAL, isSelected: true }] });

    render(<MyStrategiesPage />);

    await waitFor(() => screen.getByText('Impacto táctico'));

    fireEvent.click(screen.getByRole('button', { name: /usar esta estrategia/i }));

    await waitFor(() => {
      expect(selectStrategy).toHaveBeenCalledWith('s-2');
      expect(listStrategies).toHaveBeenCalledTimes(2);
    });
  });

  it('edita los pesos generales con suma válida y guarda', async () => {
    editWeights.mockResolvedValueOnce({ ...PERFORMANCE, weights: { goals: 0.6, assists: 0.4 } });

    render(<MyStrategiesPage />);
    await waitFor(() => screen.getByText('Performance general'));

    const cards = screen.getAllByText(/Editar pesos/i);
    fireEvent.click(cards[0]);

    const [goalsInput, assistsInput] = screen.getAllByDisplayValue('0.5');
    fireEvent.change(goalsInput, { target: { value: '0.6' } });
    fireEvent.change(assistsInput, { target: { value: '0.4' } });

    const saveButtons = screen.getAllByRole('button', { name: /^Guardar$/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(editWeights).toHaveBeenCalledWith('s-1', { goals: 0.6, assists: 0.4 });
    });
  });

  it('deshabilita Guardar cuando la suma de los pesos no es 1.0 ±0.001', async () => {
    render(<MyStrategiesPage />);
    await waitFor(() => screen.getByText('Performance general'));

    fireEvent.click(screen.getAllByText(/Editar pesos/i)[0]);

    const [goalsInput] = screen.getAllByDisplayValue('0.5');
    fireEvent.change(goalsInput, { target: { value: '0.9' } });

    expect(screen.getByText(/debe ser 1.0/i)).toBeInTheDocument();
    const saveButtons = screen.getAllByRole('button', { name: /^Guardar$/i });
    expect(saveButtons[0]).toBeDisabled();
    expect(editWeights).not.toHaveBeenCalled();
  });

  it('dispara el recálculo y muestra el resumen de recalculados/salteados', async () => {
    recalculate.mockResolvedValueOnce({
      recalculated: [{ playerId: 'p-1', value: 50, score: 0.5 }],
      skipped: [{ playerId: 'p-2', reason: 'faltan métricas' }],
    });

    render(<MyStrategiesPage />);
    await waitFor(() => screen.getByText('Performance general'));

    fireEvent.click(screen.getByRole('button', { name: /^Recalcular$/i }));

    await waitFor(() => {
      expect(recalculate).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Cotizaciones actualizadas:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/Jugadores salteados \(1\)/)).toBeInTheDocument();
    });
  });

  it('muestra un error si falla el recálculo', async () => {
    recalculate.mockRejectedValueOnce(new Error('Ya hay un recálculo en curso'));

    render(<MyStrategiesPage />);
    await waitFor(() => screen.getByText('Performance general'));

    fireEvent.click(screen.getByRole('button', { name: /^Recalcular$/i }));

    await waitFor(() => {
      expect(screen.getByText('Ya hay un recálculo en curso')).toBeInTheDocument();
    });
  });
});
