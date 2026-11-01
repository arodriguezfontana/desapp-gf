/** Lado de una Order (020-order-matching-engine, spec FR-008). */
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

/** El lado opuesto es, siempre, el unico criterio de "contraparte" del matching (spec Assumptions). */
export function oppositeSide(side: OrderSide): OrderSide {
  return side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
}
