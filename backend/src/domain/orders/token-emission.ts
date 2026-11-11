import { TokenHolding } from '../portfolio/token-holding';
import { TokenTransactionType } from './enums/token-transaction-type';
import { TokenTransaction } from './token-transaction';

/** Tokens que el sistema emite por jugador al superusuario en el momento cero (020-order-matching-engine). */
export const INITIAL_EMISSION_QUANTITY = 100;

/**
 * Emisión inicial de tokens de un jugador a un titular (030-token-balance-snapshot). Devuelve la
 * tenencia con la cantidad emitida y su asiento de auditoría: un CREDIT con saldo anterior 0 y
 * posterior igual a lo emitido, sin orden ni contraparte (la emisión no nace de ninguna orden).
 * El saldo del asiento sale de la misma operación que acredita la tenencia (`applyCredit`).
 *
 * `newId` se inyecta para mantener el dominio sin dependencias de infraestructura. El Service debe
 * persistir la tenencia y el asiento en una sola transacción (Principio VI).
 */
export function issueInitialEmission(props: {
  userId: string;
  playerId: string;
  price: number;
  createdAt: Date;
  newId: () => string;
}): { holding: TokenHolding; entry: TokenTransaction } {
  const { holding, snapshot } = TokenHolding.createEmpty(props.userId, props.playerId).applyCredit(
    INITIAL_EMISSION_QUANTITY,
  );
  const entry = TokenTransaction.create({
    id: props.newId(),
    userId: props.userId,
    type: TokenTransactionType.CREDIT,
    playerId: props.playerId,
    quantity: INITIAL_EMISSION_QUANTITY,
    price: props.price,
    orderId: null,
    counterpartOrderId: null,
    createdAt: props.createdAt,
    balanceBefore: snapshot.before,
    balanceAfter: snapshot.after,
  });
  return { holding, entry };
}
