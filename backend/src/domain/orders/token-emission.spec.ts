import { TokenTransactionType } from './enums/token-transaction-type';
import { INITIAL_EMISSION_QUANTITY, issueInitialEmission } from './token-emission';

/** 030-token-balance-snapshot: la emisión inicial de tokens también queda auditada. */
describe('issueInitialEmission', () => {
  const createdAt = new Date('2026-11-10T12:00:00Z');
  const input = { userId: 'superuser-id', playerId: 'player-1', price: 12.5, createdAt, newId: () => 'tx-emission-1' };

  it('la cantidad emitida por jugador es 100', () => {
    expect(INITIAL_EMISSION_QUANTITY).toBe(100);
  });

  it('devuelve la tenencia con los 100 tokens del titular y jugador indicados', () => {
    const { holding } = issueInitialEmission(input);

    expect(holding.userId).toBe('superuser-id');
    expect(holding.playerId).toBe('player-1');
    expect(holding.quantity).toBe(100);
  });

  it('el asiento es un CREDIT por 100 con saldo anterior 0 y posterior 100', () => {
    const { entry } = issueInitialEmission(input);

    expect(entry.type).toBe(TokenTransactionType.CREDIT);
    expect(entry.quantity).toBe(100);
    expect(entry.balanceBefore).toBe(0);
    expect(entry.balanceAfter).toBe(100);
  });

  it('el asiento no tiene orden ni contraparte y se reconoce como emisión', () => {
    const { entry } = issueInitialEmission(input);

    expect(entry.orderId).toBeNull();
    expect(entry.counterpartOrderId).toBeNull();
    expect(entry.isEmission).toBe(true);
  });

  it('el asiento lleva el titular, el jugador, el precio y el instante recibidos, y el id que genera newId', () => {
    const { entry } = issueInitialEmission(input);

    expect(entry.userId).toBe('superuser-id');
    expect(entry.playerId).toBe('player-1');
    expect(entry.price).toBe(12.5);
    expect(entry.createdAt).toBe(createdAt);
    expect(entry.id).toBe('tx-emission-1');
  });

  it('el saldo posterior del asiento coincide con la cantidad de la tenencia emitida', () => {
    const { holding, entry } = issueInitialEmission(input);

    expect(entry.balanceAfter).toBe(holding.quantity);
  });
});
