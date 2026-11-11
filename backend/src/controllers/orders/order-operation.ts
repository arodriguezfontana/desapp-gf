import { OrderSide } from '../../domain/orders/enums/order-side';
import { AuditRequest } from '../../shared/observability/business-audit/audited-operation.decorator';

/**
 * Nombre semántico de la operación de `POST /orders` para la auditoría de negocio (spec 028, US5): el
 * mismo método y ruta son una compra o una venta de tokens según `side`. El interceptor corre antes del
 * `ValidationPipe`, así que lee el cuerpo crudo; una orden con `side` inválido nunca se audita, porque la
 * validación del DTO la rechaza antes de ejecutarse. No modifica la request.
 */
export function resolveOrderOperation(req: AuditRequest): string {
  const side = (req.body as { side?: unknown } | undefined)?.side;
  if (side === OrderSide.BUY) return 'TOKENS_BOUGHT';
  if (side === OrderSide.SELL) return 'TOKENS_SOLD';
  return 'ORDER_PLACED';
}
