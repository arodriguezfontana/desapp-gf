import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyCompositionChart } from './StrategyCompositionChart';

describe('StrategyCompositionChart', () => {
  it('renderiza el estado vacío cuando no hay pesos configurados', () => {
    render(<StrategyCompositionChart weights={{}} />);

    expect(
      screen.getByText('Esta estrategia todavía no tiene pesos configurados.'),
    ).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renderiza una barra por cada factor de peso', () => {
    render(<StrategyCompositionChart weights={{ goals: 0.4, assists: 0.3, minutes: 0.3 }} />);

    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(document.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(3);
  });

  it('incluye un factor con peso en cero, no lo omite', () => {
    render(<StrategyCompositionChart weights={{ goals: 1, assists: 0 }} />);

    // El factor en 0 no dibuja una barra con ancho visible, pero sigue apareciendo
    // como categoría propia en el eje (no se omite silenciosamente del gráfico).
    expect(
      document.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick'),
    ).toHaveLength(2);
  });
});
