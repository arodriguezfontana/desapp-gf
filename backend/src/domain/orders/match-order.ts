import { Order } from './order';
import { OrderSide } from './order-side';

/**
 * Una porcion ejecutada entre la orden nueva y una candidata (020-order-matching-engine,
 * spec FR-016/FR-017). `buyOrderId`/`sellOrderId` identifican siempre la
 * orden BUY y la orden SELL de este fill puntual, sin importar cual de las
 * dos es "la nueva" — asi el Service puede escribir CREDIT/DEBIT sin volver
 * a inferir quien es quien.
 */
export interface Fill {
  buyOrderId: string;
  sellOrderId: string;
  buyerUserId: string;
  sellerUserId: string;
  quantity: number;
  price: number;
}

/** Resultado puro del matching: que le queda a cada candidata tocada, el estado final de la orden nueva, y los fills aplicados (en orden FIFO). */
export interface MatchPlan {
  updatedCandidates: Order[];
  newOrderFinal: Order;
  fills: Fill[];
}

/**
 * Funcion pura de dominio (020-order-matching-engine, spec DD-001, FR-011 a
 * FR-015): dada una orden nueva y sus candidatas YA filtradas (mismo
 * jugador, lado opuesto, precio exacto, con cantidad pendiente) y YA
 * ordenadas FIFO por `(createdAt, id)` ascendente, consume candidatas en ese
 * orden hasta cubrir toda la cantidad pedida o agotarlas. Sin NestJS, sin
 * TypeORM, sin efectos de lado — enteramente testeable en aislamiento
 * (constitucion, Principio II/IX).
 *
 * `candidates` se asume ya validada por el caller (el llamador es quien
 * lockea y filtra); `isCompatibleWith` se usa aca solo como red de
 * seguridad defensiva, no como el filtro primario.
 */
export function matchOrder(newOrder: Order, candidates: Order[]): MatchPlan {
  const updatedCandidates: Order[] = [];
  const fills: Fill[] = [];
  let current = newOrder;
  const isNewOrderBuy = newOrder.side === OrderSide.BUY;

  for (const candidate of candidates) {
    if (current.remainingQuantity <= 0) {
      break;
    }
    if (!current.isCompatibleWith(candidate)) {
      continue;
    }

    const fillQuantity = Math.min(current.remainingQuantity, candidate.remainingQuantity);
    if (fillQuantity <= 0) {
      continue;
    }

    const filledCandidate = candidate.fill(fillQuantity);
    current = current.fill(fillQuantity);

    fills.push({
      buyOrderId: isNewOrderBuy ? current.id : candidate.id,
      sellOrderId: isNewOrderBuy ? candidate.id : current.id,
      buyerUserId: isNewOrderBuy ? newOrder.userId : candidate.userId,
      sellerUserId: isNewOrderBuy ? candidate.userId : newOrder.userId,
      quantity: fillQuantity,
      price: newOrder.price,
    });

    updatedCandidates.push(filledCandidate);
  }

  return { updatedCandidates, newOrderFinal: current, fills };
}
