import { TokenTransactionType } from './enums/token-transaction-type';
import { chainBalances, ChainMovement, orderForChain } from './balance-chain';
import { NegativeBalanceChainError } from './errors/negative-balance-chain.error';

const { CREDIT, DEBIT } = TokenTransactionType;

const movement = (id: string, type: TokenTransactionType, quantity: number, iso: string): ChainMovement => ({
  id,
  type,
  quantity,
  createdAt: new Date(iso),
});

describe('orderForChain', () => {
  it('ordena por instante ascendente', () => {
    const late = movement('a', CREDIT, 1, '2026-01-02T00:00:00Z');
    const early = movement('b', CREDIT, 1, '2026-01-01T00:00:00Z');

    expect(orderForChain([late, early]).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('a igual instante pone los CREDIT antes que los DEBIT', () => {
    const debit = movement('a', DEBIT, 1, '2026-01-01T00:00:00Z');
    const credit = movement('b', CREDIT, 1, '2026-01-01T00:00:00Z');

    expect(orderForChain([debit, credit]).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('a igual instante y tipo desempata por id ascendente', () => {
    const second = movement('b', CREDIT, 1, '2026-01-01T00:00:00Z');
    const first = movement('a', CREDIT, 1, '2026-01-01T00:00:00Z');

    expect(orderForChain([second, first]).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('es determinista: no depende del orden de la entrada', () => {
    const items = [
      movement('d', DEBIT, 2, '2026-01-01T00:00:00Z'),
      movement('c', CREDIT, 2, '2026-01-01T00:00:00Z'),
      movement('b', CREDIT, 3, '2026-01-01T00:00:00Z'),
      movement('a', CREDIT, 1, '2025-12-31T00:00:00Z'),
    ];

    const expected = orderForChain(items).map((m) => m.id);

    expect(orderForChain([...items].reverse()).map((m) => m.id)).toEqual(expected);
    expect(orderForChain([items[2], items[0], items[3], items[1]]).map((m) => m.id)).toEqual(expected);
  });

  it('no muta la entrada', () => {
    const items = [movement('b', CREDIT, 1, '2026-01-02T00:00:00Z'), movement('a', CREDIT, 1, '2026-01-01T00:00:00Z')];

    orderForChain(items);

    expect(items.map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('chainBalances', () => {
  it('encadena los saldos: cada anterior es el posterior del precedente', () => {
    const result = chainBalances(10, [
      { type: CREDIT, quantity: 5 },
      { type: DEBIT, quantity: 12 },
    ]);

    expect(result).toEqual([
      { before: 10, after: 15 },
      { before: 15, after: 3 },
    ]);
  });

  it('con apertura 0 y sin movimientos devuelve una lista vacía', () => {
    expect(chainBalances(0, [])).toEqual([]);
  });

  it('un débito que deja el saldo en 0 es válido', () => {
    expect(chainBalances(4, [{ type: DEBIT, quantity: 4 }])).toEqual([{ before: 4, after: 0 }]);
  });

  it('lanza NegativeBalanceChainError si algún saldo quedaría negativo', () => {
    expect(() => chainBalances(0, [{ type: DEBIT, quantity: 1 }])).toThrow(NegativeBalanceChainError);
  });

  it('lanza NegativeBalanceChainError si la apertura es negativa', () => {
    expect(() => chainBalances(-1, [])).toThrow(NegativeBalanceChainError);
  });
});
