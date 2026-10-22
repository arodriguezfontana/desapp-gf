import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HoldingList } from './HoldingList';
import type { Holding } from '../types/portfolio';

describe('HoldingList', () => {
  const mockHoldings: Holding[] = [
    {
      playerId: 'player-1',
      playerName: 'Kylian Mbappé',
      tokenQuantity: 15,
      averageBuyPrice: 120,
      currentPrice: 140,
      totalProfitLoss: 300,
    },
    {
      playerId: 'player-2',
      playerName: 'Jude Bellingham',
      tokenQuantity: 10,
      averageBuyPrice: 150,
      currentPrice: 130,
      totalProfitLoss: -200,
    },
  ];

  it('renderiza correctamente las posiciones de los futbolistas y sus métricas', () => {
    render(<MemoryRouter><HoldingList holdings={mockHoldings} /></MemoryRouter>);

    expect(screen.getByText('Mis Posiciones (2)')).toBeInTheDocument();
    // desktop table + mobile card + leyenda del gráfico de distribución
    expect(screen.getAllByText('Kylian Mbappé')).toHaveLength(3);
    expect(screen.getAllByText('Jude Bellingham')).toHaveLength(3);

    expect(screen.getAllByText('+$300.00')[0]).toHaveClass('text-[#6ab547]');
    expect(screen.getAllByText('-$200.00')[0]).toHaveClass('text-red-500');
  });

  it('muestra el gráfico de distribución del portfolio junto a la tabla de posiciones', () => {
    render(<MemoryRouter><HoldingList holdings={mockHoldings} /></MemoryRouter>);

    expect(screen.getByText('Distribución del Portfolio')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('muestra la cantidad de tokens, precio medio y cotización actual', () => {
    render(<MemoryRouter><HoldingList holdings={[mockHoldings[0]]} /></MemoryRouter>);

    // Table elements
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText('$120.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$140.00').length).toBeGreaterThan(0);
  });
});

