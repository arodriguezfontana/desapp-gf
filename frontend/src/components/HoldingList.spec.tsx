import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HoldingList } from './HoldingList';
import type { Holding } from '../types/portfolio';

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

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('HoldingList', () => {
  it('muestra el título con la cantidad de posiciones', () => {
    wrap(<HoldingList holdings={mockHoldings} />);
    expect(screen.getByText('Mis Posiciones (2)')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay holdings', () => {
    wrap(<HoldingList holdings={[]} />);
    expect(screen.getByText('Aún no tenés posiciones en tu portfolio.')).toBeInTheDocument();
    expect(screen.queryByText('Distribución del Portfolio')).not.toBeInTheDocument();
  });

  it('muestra el gráfico de distribución con una barra por jugador', () => {
    wrap(<HoldingList holdings={mockHoldings} />);
    expect(screen.getByText('Distribución del Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Kylian Mbappé')).toBeInTheDocument();
    expect(screen.getByText('Jude Bellingham')).toBeInTheDocument();
  });
});
