import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { OperationHistory } from './OperationHistory';
import type { TokenTransactionDto } from '../types/orders.types';

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function buildTransaction(overrides: Partial<TokenTransactionDto> & { id: string }): TokenTransactionDto {
  return {
    type: 'CREDIT',
    playerId: 'player-1',
    playerName: 'Jugador Test',
    quantity: 1,
    price: '10.00',
    orderId: 'order-1',
    counterpartOrderId: 'order-2',
    createdAt: '2026-10-21T10:00:00.000Z',
    ...overrides,
  };
}

describe('OperationHistory', () => {
  it('muestra spinner de carga cuando isLoading es true', () => {
    renderWithRouter(<OperationHistory transactions={[]} isLoading={true} error={null} />);

    expect(screen.getByText('Cargando historial...')).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando ocurre un fallo', () => {
    renderWithRouter(<OperationHistory transactions={[]} isLoading={false} error="Fallo al obtener historial" />);

    expect(screen.getByText('Fallo al obtener historial')).toBeInTheDocument();
  });

  it('muestra mensaje de lista vacía cuando no hay transacciones', () => {
    renderWithRouter(<OperationHistory transactions={[]} isLoading={false} error={null} />);

    expect(
      screen.getByText('Aún no tenés operaciones ejecutadas. Las compras y ventas completadas aparecerán acá.'),
    ).toBeInTheDocument();
  });

  it('oculta el encabezado cuando hideHeader es true', () => {
    renderWithRouter(<OperationHistory transactions={[]} isLoading={false} error={null} hideHeader />);

    expect(screen.queryByText(/Historial de Operaciones/)).not.toBeInTheDocument();
  });

  it('no muestra controles de paginación si hay 8 o menos transacciones', () => {
    const transactions = Array.from({ length: 8 }, (_, i) => buildTransaction({ id: `tx-${i}` }));
    renderWithRouter(<OperationHistory transactions={transactions} isLoading={false} error={null} />);

    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
  });

  it('pagina de a 8 transacciones por página, mostrando solo esa porción', () => {
    const transactions = Array.from({ length: 20 }, (_, i) =>
      buildTransaction({ id: `tx-${i}`, playerName: `Jugador ${i}` }),
    );
    renderWithRouter(<OperationHistory transactions={transactions} isLoading={false} error={null} />);

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    // Jugadores 0-7 visibles (tabla desktop + tarjeta mobile), 8-19 todavía no.
    expect(screen.getAllByText('Jugador 7').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jugador 8')).not.toBeInTheDocument();
  });

  it('el botón "Anterior" está deshabilitado en la primera página y "Siguiente" avanza de página', () => {
    const transactions = Array.from({ length: 20 }, (_, i) =>
      buildTransaction({ id: `tx-${i}`, playerName: `Jugador ${i}` }),
    );
    renderWithRouter(<OperationHistory transactions={transactions} isLoading={false} error={null} />);

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getAllByText('Jugador 0').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jugador 8')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getAllByText('Jugador 8').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jugador 0')).not.toBeInTheDocument();
  });

  it('el botón "Siguiente" está deshabilitado en la última página', () => {
    const transactions = Array.from({ length: 12 }, (_, i) => buildTransaction({ id: `tx-${i}` }));
    renderWithRouter(<OperationHistory transactions={transactions} isLoading={false} error={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });
});
