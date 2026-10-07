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
    expect(screen.getByText('Delantero')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Ver detalle/i });
    expect(link).toHaveAttribute('href', '/catalog/p-1');
  });

  it('renderiza goles, asistencias y tarjetas amarillas cuando tienen valor', () => {
    const playerWithStats = {
      id: 'p-2',
      name: 'Lionel Messi',
      league: 'La Liga',
      team: 'Barcelona',
      position: 'FW',
      goals: 25,
      assists: 14,
      yellowCards: 3,
    };

    render(
      <MemoryRouter>
        <PlayerCard player={playerWithStats} />
      </MemoryRouter>,
    );

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Goles')).toBeInTheDocument();
    expect(screen.getByText('Asist.')).toBeInTheDocument();
    expect(screen.getByText('Amarillas')).toBeInTheDocument();
  });

  it('renderiza guiones "—" cuando las estadísticas son null', () => {
    const playerWithoutStats = {
      id: 'p-3',
      name: 'Jugador Sin Datos',
      league: 'Serie A',
      team: 'Milan',
      position: 'MF',
      goals: null,
      assists: null,
      yellowCards: null,
    };

    render(
      <MemoryRouter>
        <PlayerCard player={playerWithoutStats} />
      </MemoryRouter>,
    );

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
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

