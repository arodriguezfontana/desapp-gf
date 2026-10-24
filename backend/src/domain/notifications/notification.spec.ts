import { randomUUID } from 'node:crypto';
import { AlertCondition } from '../alerts/alert-condition';
import { Notification } from './notification';

describe('Notification (dominio, sin Nest ni DB)', () => {
  const baseProps = () => ({
    id: randomUUID(),
    userId: randomUUID(),
    alertId: randomUUID(),
    playerId: randomUUID(),
    condition: AlertCondition.PRICE_BELOW,
    triggeredValue: 9.5,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  it('se crea con read = false', () => {
    const notification = Notification.create(baseProps());
    expect(notification.read).toBe(false);
  });

  describe('markAsRead', () => {
    it('pasa de false a true', () => {
      const notification = Notification.create(baseProps());
      expect(notification.markAsRead().read).toBe(true);
    });

    it('es idempotente: marcar como leída una ya leída no cambia nada', () => {
      const read = Notification.create(baseProps()).markAsRead();
      const readAgain = read.markAsRead();
      expect(readAgain.read).toBe(true);
      expect(readAgain).not.toBe(undefined);
    });
  });

  describe('isOwnedBy', () => {
    it('true solo para el userId destinatario', () => {
      const props = baseProps();
      const notification = Notification.create(props);
      expect(notification.isOwnedBy(props.userId)).toBe(true);
      expect(notification.isOwnedBy(randomUUID())).toBe(false);
    });
  });
});
