import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogFilters } from './CatalogFilters';

describe('CatalogFilters', () => {
  it('renderiza los selectores de liga y posicion con sus opciones', () => {
    render(
      <CatalogFilters
        selectedLeague=""
        selectedPosition=""
        teamInput=""
        onLeagueChange={vi.fn()}
        onPositionChange={vi.fn()}
        onTeamInputChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Liga \/ Competencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Posición en cancha/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej. Boca Juniors, Real Madrid.../i)).toBeInTheDocument();

    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('Arquero (GK)')).toBeInTheDocument();
  });

  it('emite el cambio al seleccionar una liga o ingresar un equipo', () => {
    const onLeagueChange = vi.fn();
    const onTeamInputChange = vi.fn();

    render(
      <CatalogFilters
        selectedLeague=""
        selectedPosition=""
        teamInput=""
        onLeagueChange={onLeagueChange}
        onPositionChange={vi.fn()}
        onTeamInputChange={onTeamInputChange}
        onClearFilters={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Liga \/ Competencia/i), {
      target: { value: 'La Liga' },
    });
    expect(onLeagueChange).toHaveBeenCalledWith('La Liga');

    fireEvent.change(screen.getByPlaceholderText(/Ej. Boca Juniors, Real Madrid.../i), {
      target: { value: 'Barcelona' },
    });
    expect(onTeamInputChange).toHaveBeenCalledWith('Barcelona');
  });

  it('muestra el boton de limpiar filtros si hay al menos un filtro activo', () => {
    const onClearFilters = vi.fn();
    render(
      <CatalogFilters
        selectedLeague="Serie A"
        selectedPosition=""
        teamInput=""
        onLeagueChange={vi.fn()}
        onPositionChange={vi.fn()}
        onTeamInputChange={vi.fn()}
        onClearFilters={onClearFilters}
      />,
    );

    const clearBtn = screen.getByRole('button', { name: /Limpiar filtros/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

