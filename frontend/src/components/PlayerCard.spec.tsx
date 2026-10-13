import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerCard } from './PlayerCard';

const playerMock = {
  id: 'p-1',
  name: 'Edinson Cavani',
  league: 'Premier League',
  team: 'Boca Juniors',
  position: 'FW',
  goals: 10,
  assists: 5,
  yellowCards: 2,
};

describe('PlayerCard', () => {
  it('renderiza la informacion del jugador con su link al detalle', () => {
    render(
      <MemoryRouter>
        <PlayerCard player={playerMock} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Edinson Cavani')).toBeInTheDocument();
    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('Boca Juniors')).toBeInTheDocument();
    expect(screen.getByText('Delantero')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Ver detalle/i });
    expect(link).toHaveAttribute('href', '/catalog/p-1');
  });

  it('muestra el valor del token redondeado cuando hay cotización', () => {
    render(
      <MemoryRouter>
        <PlayerCard player={playerMock} quote={{ value: 71.52, score: 0.712 }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('muestra "—" cuando no hay cotización', () => {
    render(
      <MemoryRouter>
        <PlayerCard player={playerMock} quote={null} />
      </MemoryRouter>,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it.each([
    ['GK', 'Arquero', 'text-[#b79753]'],
    ['DF', 'Defensor', 'text-blue-400'],
    ['MF', 'Mediocampista', 'text-[#2dd4bf]'],
    ['FW', 'Delantero', 'text-purple-400'],
    ['XX', 'XX', 'text-slate-300'],
  ])('asigna el color de badge correspondiente a la posición %s', (position, expectedLabel, expectedClass) => {
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

    expect(screen.getByText(expectedLabel)).toHaveClass(expectedClass);
  });
});

