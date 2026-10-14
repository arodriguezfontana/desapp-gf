import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioSummary } from './PortfolioSummary';

describe('PortfolioSummary', () => {
  it('renderiza las 3 métricas de resumen global con formato de moneda', () => {
    render(
      <PortfolioSummary
        summary={{
          totalInvested: 2500,
          totalCurrentValue: 3100,
          netProfitLoss: 600,
        }}
      />,
    );

    expect(screen.getByText('Capital Total Invertido')).toBeInTheDocument();
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();

    expect(screen.getByText('Valor Actual de Cartera')).toBeInTheDocument();
    expect(screen.getByText('$3,100.00')).toBeInTheDocument();

    expect(screen.getByText('Rendimiento Neto')).toBeInTheDocument();
    expect(screen.getByText('+$600.00')).toBeInTheDocument();
  });

  it('aplica color secondary #6ab547 y signo + ante ganancia neta positiva', () => {
    render(
      <PortfolioSummary
        summary={{
          totalInvested: 1000,
          totalCurrentValue: 1250,
          netProfitLoss: 250,
        }}
      />,
    );

    const profitElement = screen.getByText('+$250.00');
    expect(profitElement).toHaveClass('text-[#6ab547]');
    expect(screen.getByText('+25.00%')).toBeInTheDocument();
  });

  it('aplica color rojo Tailwind ante pérdida neta', () => {
    render(
      <PortfolioSummary
        summary={{
          totalInvested: 2000,
          totalCurrentValue: 1600,
          netProfitLoss: -400,
        }}
      />,
    );

    const lossElement = screen.getByText('-$400.00');
    expect(lossElement).toHaveClass('text-red-500');
    expect(screen.getByText('-20.00%')).toBeInTheDocument();
  });

  it('aplica formato neutral ante rendimiento cero', () => {
    render(
      <PortfolioSummary
        summary={{
          totalInvested: 1000,
          totalCurrentValue: 1000,
          netProfitLoss: 0,
        }}
      />,
    );

    const neutralElement = screen.getByText('$0.00');
    expect(neutralElement).toHaveClass('text-gray-300');
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });
});

