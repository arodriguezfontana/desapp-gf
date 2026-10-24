import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityTabs } from './ActivityTabs';
import type { OrderResponseDto, TokenTransactionDto } from '../types/orders.types';

const mockOrders: OrderResponseDto[] = [
  {
    id: 'order-1',
    side: 'BUY',
    playerId: 'player-1',
    quantity: 10,
    remainingQuantity: 10,
    price: '15.00',
    status: 'PENDING',
    createdAt: '2026-10-21T10:00:00.000Z',
    fills: [],
  },
];

const mockTransactions: TokenTransactionDto[] = [
  {
    id: 'tx-1',
    type: 'CREDIT',
    playerId: 'player-1',
    playerName: 'Jugador Test',
    quantity: 5,
    price: '10.00',
    orderId: 'order-1',
    counterpartOrderId: 'order-2',
    createdAt: '2026-10-21T10:00:00.000Z',
  },
];

function renderTabs() {
  return render(
    <MemoryRouter>
      <ActivityTabs
        orders={mockOrders}
        isOrdersLoading={false}
        cancellingOrderId={null}
        ordersError={null}
        onCancelOrder={vi.fn().mockResolvedValue(true)}
        transactions={mockTransactions}
        isHistoryLoading={false}
        historyError={null}
      />
    </MemoryRouter>,
  );
}

describe('ActivityTabs', () => {
  it('muestra la pestaña "Mis Órdenes" activa por defecto', () => {
    renderTabs();

    expect(screen.getAllByText('PENDIENTE').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jugador Test')).not.toBeInTheDocument();
  });

  it('cambia a "Historial de Operaciones" al hacer click en esa pestaña', () => {
    renderTabs();

    fireEvent.click(screen.getByRole('button', { name: /Historial de Operaciones/ }));

    expect(screen.getAllByText('Jugador Test').length).toBeGreaterThan(0);
    expect(screen.queryByText('PENDIENTE')).not.toBeInTheDocument();
  });

  it('vuelve a "Mis Órdenes" al hacer click nuevamente en esa pestaña', () => {
    renderTabs();

    fireEvent.click(screen.getByRole('button', { name: /Historial de Operaciones/ }));
    fireEvent.click(screen.getByRole('button', { name: /Mis Órdenes/ }));

    expect(screen.getAllByText('PENDIENTE').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jugador Test')).not.toBeInTheDocument();
  });

  it('muestra el conteo de órdenes y transacciones en las etiquetas de las pestañas', () => {
    renderTabs();

    expect(screen.getByRole('button', { name: 'Mis Órdenes (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Historial de Operaciones (1)' })).toBeInTheDocument();
  });
});
