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
  shots: 3,
  yellowCards: 2,
};

describe('PlayerCard', () => {
  it('renderiza la informacion del jugador con la card completa como link al detalle', () => {
    render(
      <MemoryRouter>
        <PlayerCard player={playerMock} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Edinson Cavani')).toBeInTheDocument();
    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('Boca Juniors')).toBeInTheDocument();
    expect(screen.getByText('Delantero')).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/p-1');
    expect(screen.queryByText(/Ver detalle/i)).not.toBeInTheDocument();
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
    ['FW', ['Goles', 'Asis.', 'Remates'], ['TA', 'Entradas']],
    ['MF', ['Asis.', 'P. clave', 'Regates'], ['Goles', 'TA']],
    ['DF', ['Entradas', 'Interc.', 'Rating'], ['Goles', 'TA']],
    ['GK', ['Rating', 'Pases', 'Interc.'], ['Goles', 'Asis.', 'TA']],
  ])('muestra las estadísticas significativas de la posición %s', (position, visible, hidden) => {
    render(
      <MemoryRouter>
        <PlayerCard player={{ ...playerMock, position }} />
      </MemoryRouter>,
    );

    for (const label of visible) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const label of hidden) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('muestra los promedios con un decimal y los acumulados como enteros', () => {
    render(
      <MemoryRouter>
        <PlayerCard player={{ ...playerMock, position: 'GK', rating: 7.34, passesCompleted: 28 }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('7.3')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('usa las estadísticas por defecto cuando la posición es desconocida', () => {
    render(
      <MemoryRouter>
        <PlayerCard player={{ ...playerMock, position: 'XX' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Goles')).toBeInTheDocument();
    expect(screen.getByText('TA')).toBeInTheDocument();
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

