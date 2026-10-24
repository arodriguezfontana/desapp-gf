import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuoteHistoryChart } from './QuoteHistoryChart';
import type { PlayerQuote } from '../types/catalog.types';

const makeQuote = (overrides: Partial<PlayerQuote> = {}): PlayerQuote => ({
  id: 'q-1',
  playerId: 'p-1',
  strategyId: 's-1',
  score: 0.5,
  value: 50,
  calculatedAt: '2026-09-01T00:00:00.000Z',
  appliedPosition: null,
  ...overrides,
});

describe('QuoteHistoryChart', () => {
  it('renderiza el estado vacío (sin svg) cuando no hay cotizaciones', () => {
    render(<QuoteHistoryChart quotes={[]} />);

    expect(
      screen.getByText('Todavía no hay historial de cotizaciones para este jugador.'),
    ).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renderiza el gráfico con un punto por cotización cuando hay varias', () => {
    const quotes: PlayerQuote[] = [
      makeQuote({ id: 'q-1', value: 50, calculatedAt: '2026-09-01T00:00:00.000Z' }),
      makeQuote({ id: 'q-2', value: 65, calculatedAt: '2026-09-08T00:00:00.000Z' }),
      makeQuote({ id: 'q-3', value: 71, calculatedAt: '2026-09-15T00:00:00.000Z' }),
    ];

    render(<QuoteHistoryChart quotes={quotes} />);

    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(document.querySelectorAll('.recharts-dot')).toHaveLength(3);
    expect(document.querySelector('.recharts-line-curve')).toBeInTheDocument();
  });

  it('renderiza un único punto sin error cuando solo hay una cotización', () => {
    render(<QuoteHistoryChart quotes={[makeQuote()]} />);

    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(document.querySelectorAll('.recharts-dot')).toHaveLength(1);
  });
});
