import { NegativeBalanceChainError } from '../../domain/orders/errors/negative-balance-chain.error';
import { TokenTransactionType } from '../../domain/orders/enums/token-transaction-type';
import { BOT_INITIAL_HOLDING } from './simulation-plans';
import { buildSimulationSnapshots, SimulatedMovement } from './simulation-balances';

const { CREDIT, DEBIT } = TokenTransactionType;

const move = (
  id: string,
  userId: string,
  playerId: string,
  type: TokenTransactionType,
  quantity: number,
  iso: string,
): SimulatedMovement => ({ id, userId, playerId, type, quantity, createdAt: new Date(iso) });

const opening = (userId: string): number => (userId.startsWith('bot') ? BOT_INITIAL_HOLDING : 0);

describe('buildSimulationSnapshots', () => {
  const movements = [
    move('admin-2', 'admin', 'p1', DEBIT, 10, '2026-01-05T00:00:00Z'),
    move('admin-1', 'admin', 'p1', CREDIT, 30, '2026-01-01T00:00:00Z'),
    move('bot-1', 'bot-a', 'p1', DEBIT, 30, '2026-01-01T00:00:00Z'),
    move('bot-2', 'bot-b', 'p1', CREDIT, 10, '2026-01-05T00:00:00Z'),
    move('admin-p2', 'admin', 'p2', CREDIT, 5, '2026-01-02T00:00:00Z'),
  ];

  it('encadena los saldos por (usuario, jugador) en orden cronológico, sin importar el orden de entrada', () => {
    const snapshots = buildSimulationSnapshots(movements, opening);

    expect(snapshots.get('admin-1')).toEqual({ before: 0, after: 30 });
    expect(snapshots.get('admin-2')).toEqual({ before: 30, after: 20 });
    expect(snapshots.get('admin-p2')).toEqual({ before: 0, after: 5 });
  });

  it('los bots parten de su tenencia inicial', () => {
    const snapshots = buildSimulationSnapshots(movements, opening);

    expect(snapshots.get('bot-1')).toEqual({ before: BOT_INITIAL_HOLDING, after: BOT_INITIAL_HOLDING - 30 });
    expect(snapshots.get('bot-2')).toEqual({ before: BOT_INITIAL_HOLDING, after: BOT_INITIAL_HOLDING + 10 });
  });

  it('devuelve un snapshot por cada movimiento y ninguno negativo', () => {
    const snapshots = buildSimulationSnapshots(movements, opening);

    expect(snapshots.size).toBe(movements.length);
    for (const { before, after } of snapshots.values()) {
      expect(before).toBeGreaterThanOrEqual(0);
      expect(after).toBeGreaterThanOrEqual(0);
    }
  });

  it('el resultado no depende del orden de la entrada', () => {
    const forward = buildSimulationSnapshots(movements, opening);
    const backward = buildSimulationSnapshots([...movements].reverse(), opening);

    expect([...backward.entries()].sort()).toEqual([...forward.entries()].sort());
  });

  it('un movimiento que dejaría un saldo negativo lanza NegativeBalanceChainError', () => {
    expect(() =>
      buildSimulationSnapshots([move('x', 'admin', 'p1', DEBIT, 1, '2026-01-01T00:00:00Z')], opening),
    ).toThrow(NegativeBalanceChainError);
  });

  it('sin movimientos devuelve un mapa vacío', () => {
    expect(buildSimulationSnapshots([], opening).size).toBe(0);
  });
});
