import { reconstructHoldingChain, ChainMovement } from './balance-chain';
import { TokenTransactionType } from './enums/token-transaction-type';
import { INITIAL_EMISSION_QUANTITY } from './token-emission';

const { CREDIT, DEBIT } = TokenTransactionType;

const move = (id: string, type: TokenTransactionType, quantity: number, iso: string): ChainMovement => ({
  id,
  type,
  quantity,
  createdAt: new Date(iso),
});

/** 030-token-balance-snapshot: reconstrucción de la cadena de una tenencia para el backfill de los asientos históricos. */
describe('reconstructHoldingChain', () => {
  it('apertura 0 con compras y ventas intercaladas: cadena exacta y último saldo = saldo de cierre', () => {
    const pending = [
      move('a', CREDIT, 10, '2026-01-01T00:00:00Z'),
      move('b', DEBIT, 4, '2026-01-02T00:00:00Z'),
      move('c', CREDIT, 5, '2026-01-03T00:00:00Z'),
      move('d', DEBIT, 3, '2026-01-04T00:00:00Z'),
    ];

    const result = reconstructHoldingChain({ pending, closingBalance: 8, isSuperuser: false });

    expect(result).toEqual({
      status: 'ok',
      opening: 0,
      snapshots: new Map([
        ['a', { before: 0, after: 10 }],
        ['b', { before: 10, after: 6 }],
        ['c', { before: 6, after: 11 }],
        ['d', { before: 11, after: 8 }],
      ]),
    });
  });

  it('desempata con CREDIT antes que DEBIT al mismo instante, sin depender del orden de entrada', () => {
    const credit = move('z', CREDIT, 5, '2026-01-01T00:00:00Z');
    const debit = move('a', DEBIT, 5, '2026-01-01T00:00:00Z');

    const forward = reconstructHoldingChain({ pending: [credit, debit], closingBalance: 0, isSuperuser: false });
    const backward = reconstructHoldingChain({ pending: [debit, credit], closingBalance: 0, isSuperuser: false });

    expect(forward).toEqual(backward);
    expect(forward).toMatchObject({ status: 'ok' });
    if (forward.status === 'ok') {
      expect(forward.snapshots.get('z')).toEqual({ before: 0, after: 5 });
      expect(forward.snapshots.get('a')).toEqual({ before: 5, after: 0 });
    }
  });

  it('el superusuario con emisión histórica no auditada (cierre − neto = 100) parte de 100', () => {
    const pending = [move('s1', DEBIT, 10, '2026-01-01T00:00:00Z')];

    const result = reconstructHoldingChain({ pending, closingBalance: 90, isSuperuser: true });

    expect(result).toEqual({
      status: 'ok',
      opening: INITIAL_EMISSION_QUANTITY,
      snapshots: new Map([['s1', { before: 100, after: 90 }]]),
    });
  });

  it('el superusuario con apertura 0 (nunca tuvo emisión en ese jugador) también es válido', () => {
    const pending = [move('s1', CREDIT, 5, '2026-01-01T00:00:00Z')];

    const result = reconstructHoldingChain({ pending, closingBalance: 5, isSuperuser: true });

    expect(result).toMatchObject({ status: 'ok', opening: 0 });
  });

  it('la misma situación de emisión en un usuario común es una inconsistencia (opening-mismatch)', () => {
    const pending = [move('s1', DEBIT, 10, '2026-01-01T00:00:00Z')];

    const result = reconstructHoldingChain({ pending, closingBalance: 90, isSuperuser: false });

    expect(result).toEqual({
      status: 'inconsistent',
      reason: 'opening-mismatch',
      opening: 100,
      net: -10,
      closingBalance: 90,
    });
  });

  it('una apertura que no es 0 ni la emisión (p. ej. 250) es inconsistente, incluso para el superusuario', () => {
    const pending = [move('b1', DEBIT, 30, '2026-01-01T00:00:00Z')];

    const result = reconstructHoldingChain({ pending, closingBalance: 220, isSuperuser: true });

    expect(result).toEqual({
      status: 'inconsistent',
      reason: 'opening-mismatch',
      opening: 250,
      net: -30,
      closingBalance: 220,
    });
  });

  it('un saldo de cierre menor que el neto (apertura negativa) es inconsistente', () => {
    const pending = [move('a', CREDIT, 10, '2026-01-01T00:00:00Z')];

    const result = reconstructHoldingChain({ pending, closingBalance: 4, isSuperuser: false });

    expect(result).toMatchObject({ status: 'inconsistent', reason: 'opening-mismatch', opening: -6 });
  });

  it('una cadena que cruzaría un saldo negativo es inconsistente (negative-balance), aunque cierre bien', () => {
    // Apertura 0, el débito va antes que el crédito en el tiempo: pasaría por −5.
    const pending = [move('a', DEBIT, 5, '2026-01-01T00:00:00Z'), move('b', CREDIT, 5, '2026-01-02T00:00:00Z')];

    const result = reconstructHoldingChain({ pending, closingBalance: 0, isSuperuser: false });

    expect(result).toEqual({
      status: 'inconsistent',
      reason: 'negative-balance',
      opening: 0,
      net: 0,
      closingBalance: 0,
    });
  });

  it('sin asientos pendientes y con saldo de cierre distinto de 0 no es una cadena válida (apertura 7)', () => {
    const result = reconstructHoldingChain({ pending: [], closingBalance: 7, isSuperuser: false });

    expect(result).toMatchObject({ status: 'inconsistent', opening: 7 });
  });

  it('sin pendientes y cierre 0 devuelve ok sin snapshots', () => {
    const result = reconstructHoldingChain({ pending: [], closingBalance: 0, isSuperuser: false });

    expect(result).toEqual({ status: 'ok', opening: 0, snapshots: new Map() });
  });

  it('es determinista: la misma entrada produce el mismo resultado', () => {
    const pending = [
      move('a', CREDIT, 10, '2026-01-01T00:00:00Z'),
      move('b', DEBIT, 4, '2026-01-01T00:00:00Z'),
      move('c', CREDIT, 2, '2026-01-02T00:00:00Z'),
    ];

    const first = reconstructHoldingChain({ pending, closingBalance: 8, isSuperuser: false });
    const second = reconstructHoldingChain({ pending: [...pending].reverse(), closingBalance: 8, isSuperuser: false });

    expect(second).toEqual(first);
  });
});
