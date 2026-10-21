import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyOrders } from './MyOrders';
import type { OrderResponseDto } from '../types/orders.types';

describe('MyOrders', () => {
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
    {
      id: 'order-2',
      side: 'SELL',
      playerId: 'player-2',
      quantity: 8,
      remainingQuantity: 3,
      price: '22.50',
      status: 'PARTIALLY_FILLED',
      createdAt: '2026-10-21T09:00:00.000Z',
      fills: [],
    },
    {
      id: 'order-3',
      side: 'BUY',
      playerId: 'player-3',
      quantity: 5,
      remainingQuantity: 0,
      price: '18.00',
      status: 'COMPLETED',
      createdAt: '2026-10-20T10:00:00.000Z',
      fills: [],
    },
    {
      id: 'order-4',
      side: 'SELL',
      playerId: 'player-4',
      quantity: 6,
      remainingQuantity: 6,
      price: '30.00',
      status: 'CANCELLED',
      createdAt: '2026-10-19T10:00:00.000Z',
      fills: [],
    },
  ];

  it('muestra spinner de carga cuando isLoading es true', () => {
    render(
      <MyOrders
        orders={[]}
        isLoading={true}
        cancellingOrderId={null}
        error={null}
        onCancelOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('Cargando órdenes...')).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando ocurre un fallo', () => {
    render(
      <MyOrders
        orders={[]}
        isLoading={false}
        cancellingOrderId={null}
        error="Fallo al obtener órdenes"
        onCancelOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('Fallo al obtener órdenes')).toBeInTheDocument();
  });

  it('muestra mensaje de lista vacía cuando no hay órdenes', () => {
    render(
      <MyOrders
        orders={[]}
        isLoading={false}
        cancellingOrderId={null}
        error={null}
        onCancelOrder={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Aún no has creado órdenes. Tus posturas de compra y venta abiertas y finalizadas aparecerán acá.',
      ),
    ).toBeInTheDocument();
  });

  it('renderiza órdenes con sus badges de estado correspondientes', () => {
    render(
      <MyOrders
        orders={mockOrders}
        isLoading={false}
        cancellingOrderId={null}
        error={null}
        onCancelOrder={vi.fn()}
      />,
    );

    expect(screen.getAllByText('PENDIENTE')).toHaveLength(2); // desktop table and mobile card
    expect(screen.getAllByText('PARCIAL')).toHaveLength(2);
    expect(screen.getAllByText('COMPLETADA')).toHaveLength(2);
    expect(screen.getAllByText('CANCELADA')).toHaveLength(2);
  });

  it('muestra botón "Cancelar" solo para órdenes PENDING y PARTIALLY_FILLED', () => {
    render(
      <MyOrders
        orders={mockOrders}
        isLoading={false}
        cancellingOrderId={null}
        error={null}
        onCancelOrder={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText('Cancelar orden order-1')).toHaveLength(2);
    expect(screen.getAllByLabelText('Cancelar orden order-2')).toHaveLength(2);
    expect(screen.queryByLabelText('Cancelar orden order-3')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cancelar orden order-4')).not.toBeInTheDocument();
  });

  it('invoca onCancelOrder al hacer clic en el botón Cancelar', () => {
    const handleCancel = vi.fn().mockResolvedValue(true);
    render(
      <MyOrders
        orders={mockOrders}
        isLoading={false}
        cancellingOrderId={null}
        error={null}
        onCancelOrder={handleCancel}
      />,
    );

    const cancelButtons = screen.getAllByLabelText('Cancelar orden order-1');
    fireEvent.click(cancelButtons[0]);

    expect(handleCancel).toHaveBeenCalledWith('order-1');
  });

  it('deshabilita el botón y muestra "Cancelando..." para la orden en proceso', () => {
    render(
      <MyOrders
        orders={mockOrders}
        isLoading={false}
        cancellingOrderId="order-1"
        error={null}
        onCancelOrder={vi.fn()}
      />,
    );

    const cancellingButtons = screen.getAllByLabelText('Cancelar orden order-1');
    expect(cancellingButtons[0]).toBeDisabled();
    expect(cancellingButtons[0]).toHaveTextContent('Cancelando...');
  });
});

