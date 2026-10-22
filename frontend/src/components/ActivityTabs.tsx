import React, { useState } from 'react';
import type { OrderResponseDto, TokenTransactionDto } from '../types/orders.types';
import { MyOrders } from './MyOrders';
import { OperationHistory } from './OperationHistory';

interface ActivityTabsProps {
  orders: OrderResponseDto[];
  isOrdersLoading: boolean;
  cancellingOrderId: string | null;
  ordersError: string | null;
  onCancelOrder: (orderId: string) => Promise<boolean>;
  transactions: TokenTransactionDto[];
  isHistoryLoading: boolean;
  historyError: string | null;
}

type ActivityTab = 'orders' | 'history';

export const ActivityTabs: React.FC<ActivityTabsProps> = ({
  orders,
  isOrdersLoading,
  cancellingOrderId,
  ordersError,
  onCancelOrder,
  transactions,
  isHistoryLoading,
  historyError,
}) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('orders');

  const tabClassName = (tab: ActivityTab): string =>
    `flex-1 sm:flex-none px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl border transition-all cursor-pointer ${
      activeTab === tab
        ? 'bg-[#b79753] text-[#0b3332] border-[#b79753] shadow-lg'
        : 'bg-[#104443] text-gray-300 border-[#1a6866] hover:text-white hover:border-gray-400'
    }`;

  return (
    <section aria-label="Actividad del usuario" className="space-y-4">
      <div className="flex gap-3">
        <button type="button" onClick={() => setActiveTab('orders')} className={tabClassName('orders')}>
          Mis Órdenes ({isOrdersLoading ? '…' : orders.length})
        </button>
        <button type="button" onClick={() => setActiveTab('history')} className={tabClassName('history')}>
          Historial de Operaciones ({isHistoryLoading ? '…' : transactions.length})
        </button>
      </div>

      {activeTab === 'orders' ? (
        <MyOrders
          orders={orders}
          isLoading={isOrdersLoading}
          cancellingOrderId={cancellingOrderId}
          error={ordersError}
          onCancelOrder={onCancelOrder}
          hideHeader
        />
      ) : (
        <OperationHistory
          transactions={transactions}
          isLoading={isHistoryLoading}
          error={historyError}
          hideHeader
        />
      )}
    </section>
  );
};
