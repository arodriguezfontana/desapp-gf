import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerCard } from './PlayerCard';

describe('PlayerCard', () => {
  it('renderiza la informacion del jugador con su link al detalle', () => {
    const playerMock = {
      id: 'p-1',
      name: 'Edinson Cavani',
      league: 'Premier League',
      team: 'Boca Juniors',
      position: 'FW',
    };

    render(
      <MemoryRouter>
        <PlayerCard player={playerMock} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Edinson Cavani')).toBeInTheDocument();
    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('Boca Juniors')).toBeInTheDocument();
    expect(screen.getByText('FW')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Ver detalle/i });
    expect(link).toHaveAttribute('href', '/catalog/p-1');
  });

  it.each([
    ['GK', 'text-[#b79753]'],
    ['DF', 'text-blue-400'],
    ['MF', 'text-[#2dd4bf]'],
    ['FW', 'text-purple-400'],
    ['XX', 'text-slate-300'],
  ])('asigna el color de badge correspondiente a la posición %s', (position, expectedClass) => {
    const playerMock = {
      id: 'p-1',
      name: 'Jugador de Prueba',
      league: 'Premier League',
      team: 'Boca Juniors',
      position,
    };

    render(
      <MemoryRouter>
        <PlayerCard player={playerMock} />
      </MemoryRouter>,
    );

    expect(screen.getByText(position)).toHaveClass(expectedClass);
  });
});

