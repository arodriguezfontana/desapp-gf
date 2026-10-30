/** Tokens de inyeccion de los puertos de dominio de 020-order-matching-engine. */

/**
 * Transaccion/locking explicito de TypeORM (primer precedente del codebase,
 * research.md D4). Vive en OrdersModule porque hoy es el unico consumidor:
 * el matching de OrdersService es la unica operacion que necesita abrir una
 * transaccion que toque Order + TokenHolding + TokenTransaction a la vez.
 */
export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');
