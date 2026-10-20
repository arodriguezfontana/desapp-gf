# API Contract: Órdenes y registro con username

Formato de error uniforme vía `AllExceptionsFilter` existente.

## POST /auth/register *(extiende 001-user-auth)*

Sin cambios de guard (sigue sin requerir JWT). Body gana un campo nuevo.

Body: `{ email: string, password: string, username: string }`.

- **201**: usuario creado (sin cambios de forma de respuesta, salvo que ahora incluye
  `username` si la respuesta ya expone el usuario).
- **400**: `username` vacío/ausente (validación de forma, class-validator).
- **409**: `email` ya en uso (sin cambios) **o** `username === "superuser"` — mismo
  status code, pero el mensaje de error distingue cuál de las dos condiciones ocurrió.

## POST /orders

Requiere JWT válido (`JwtAuthGuard`).

Body: `{ side: "BUY" | "SELL", playerId: string, quantity: number }`. **MUST NOT**
aceptar un campo `price` — si se envía, se ignora o se rechaza por validación de forma
(DTO estricto, `forbidNonWhitelisted`).

- **201**: la orden resultante, reflejando su estado final inmediatamente después del
  intento de matching:
  ```json
  {
    "id": "uuid",
    "side": "BUY",
    "playerId": "uuid",
    "quantity": 10,
    "remainingQuantity": 0,
    "price": "12.50",
    "status": "COMPLETED",
    "createdAt": "2026-10-16T12:00:00.000Z",
    "fills": [
      { "counterpartOrderId": "uuid", "quantity": 7, "price": "12.50" },
      { "counterpartOrderId": "uuid", "quantity": 3, "price": "12.50" }
    ]
  }
  ```
  `fills` está vacío si la orden quedó íntegramente `PENDING` sin ninguna ejecución;
  `status` es `PARTIALLY_FILLED` si se ejecutó una parte y el resto quedó pendiente como
  esta misma orden (no se crea una orden nueva para el remanente del lado que la pidió —
  la orden nueva PENDING que describe la spec para el remanente **es esta misma fila**,
  con `remainingQuantity > 0`; una fila de "orden nueva" solo aplica a la cantidad
  original que no tenía ninguna orden previa contra la cual matchear, lo cual es
  exactamente este mismo registro).
- **400**: `side` inválido, `quantity <= 0` o no entero, o (para `SELL`) holding
  insuficiente del usuario autenticado para ese `playerId` (FR-010).
- **404**: `playerId` no existe en el catálogo.
- JWT ausente/inválido → **401** (comportamiento estándar ya existente de `JwtAuthGuard`).

### Comportamiento de matching (ver spec.md Historia 4, FR-011 a FR-015, FR-021)

1. Calcular el precio automáticamente (`QuotationService.valuate`, estrategia
   seleccionada del usuario autenticado), redondeado a 2 decimales.
2. Buscar órdenes PENDING/PARTIALLY_FILLED del lado opuesto, mismo `playerId`, mismo
   precio exacto, ordenadas por `(createdAt, id)` ascendente (FIFO).
3. Consumir candidatas en orden hasta cubrir `quantity` o agotar candidatas, bajo lock
   transaccional (ver research.md D4) para que ninguna ejecución concurrente pueda
   sobre-fillear la misma orden.
4. Por cada candidata consumida (total o parcialmente): actualizar su
   `remainingQuantity`/`status`, mover tokens entre ambos `TokenHolding`, insertar el par
   `TokenTransaction` (CREDIT al comprador, DEBIT al vendedor).
5. Si queda remanente sin cubrir, la orden nueva se persiste con ese remanente como
   `remainingQuantity` (PENDING o PARTIALLY_FILLED según si tuvo algún fill previo).

## Endpoints sin cambios reutilizados por esta feature

- `GET /players/:id/valuation` (019) — el cálculo de precio de `POST /orders` es
  exactamente este mismo cálculo, nunca uno nuevo ni manual.
