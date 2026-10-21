# Quickstart: Validación de Cancelación de Órdenes

Guía de verificación rápida de los flujos de negocio de cancelación de órdenes (`023-cancel-order`).

---

## Prerrequisitos

1. Backend corriendo en `http://localhost:3000` con base de datos sincronizada.
2. Frontend corriendo en `http://localhost:5173`.
3. Dos usuarios registrados para pruebas de control de acceso:
   * **Usuario A**: `inversorA@desapp.com`
   * **Usuario B**: `inversorB@desapp.com`
4. Usuario A posee tokens de algún jugador (para emitir órdenes `SELL`).

---

## Escenario 1: Cancelación exitosa de orden PENDING (BUY o SELL)

1. **Crear orden**:
   Con el token JWT de Usuario A, publicar una orden que no tenga contrapartida inmediata:
   ```bash
   POST http://localhost:3000/orders
   Authorization: Bearer <TOKEN_A>
   Content-Type: application/json

   {
     "side": "BUY",
     "playerId": "<PLAYER_ID>",
     "quantity": 5
   }
   ```
   *Respuesta esperada*: `201 Created`, `status: "PENDING"`, `remainingQuantity: 5`, tomar nota de `id`.

2. **Cancelar orden**:
   ```bash
   DELETE http://localhost:3000/orders/<ORDER_ID>
   Authorization: Bearer <TOKEN_A>
   ```
   *Respuesta esperada*: `200 OK`, `status: "CANCELLED"`.

3. **Verificación de libro de órdenes**:
   Publicar una orden contraria (`SELL` con mismo precio o compatible). La orden cancelada no participa en el match.

---

## Escenario 2: Liberación de tokens reservados al cancelar orden SELL

1. **Consultar portfolio antes de la orden**:
   Consultar `GET /users/<USER_A_ID>/portfolio` y anotar los tokens disponibles del jugador.
2. **Crear orden de venta**:
   Publicar `POST /orders` con `side: "SELL"` y `quantity: 3`.
3. **Verificar retención**:
   Intentar publicar otra venta que consuma el saldo total previo: el sistema rechaza por `InsufficientHoldingError` porque los 3 tokens están reservados por la orden abierta.
4. **Cancelar orden de venta**:
   Enviar `DELETE /orders/<SELL_ORDER_ID>`.
5. **Verificar liberación**:
   Volver a intentar la venta que antes fallaba: ahora procede con éxito porque los 3 tokens fueron liberados al pasar la orden a `CANCELLED`.

---

## Escenario 3: Rechazo por orden ajena (403 Forbidden)

1. Con el token JWT de Usuario B, intentar cancelar la orden creada por Usuario A:
   ```bash
   DELETE http://localhost:3000/orders/<ORDER_ID_USER_A>
   Authorization: Bearer <TOKEN_B>
   ```
   *Respuesta esperada*: `403 Forbidden`, mensaje: `"No tienes permisos para operar sobre esta orden."`.
2. Verificar que el estado de la orden sigue siendo el original.

---

## Escenario 4: Rechazo por estado no cancelable (409 Conflict)

1. **Reintento sobre orden ya cancelada**:
   Enviar nuevamente `DELETE /orders/<ORDER_ID_CANCELLED>`:
   *Respuesta esperada*: `409 Conflict`, mensaje: `"La orden no se puede cancelar porque ya fue completada o cancelada previamente."`.
2. **Cancelación sobre orden COMPLETED**:
   Tomar el ID de una orden que ya fue completada (por ejemplo, mediante un match total):
   Enviar `DELETE /orders/<ORDER_ID_COMPLETED>`:
   *Respuesta esperada*: `409 Conflict`.

---

## Escenario 5: Validación visual en Frontend ("Mis órdenes")

1. Iniciar sesión en el frontend con `inversorA@desapp.com`.
2. Navegar a **Portfolio** (`/portfolio`).
3. Desplazarse a la sección **Mis Órdenes**:
   * Las órdenes abiertas (`PENDING` o `PARTIALLY_FILLED`) muestran el botón **Cancelar** con estilo de alerta / peligro.
   * Las órdenes cerradas (`COMPLETED` o `CANCELLED`) muestran su badge de estado sin el botón de cancelación.
4. Presionar el botón **Cancelar** en una orden abierta:
   * Se dispara la petición `DELETE /orders/:id`.
   * La orden cambia de inmediato a estado `CANCELLED` y el botón desaparece.
   * Si era una venta, el balance de tokens disponibles en el resumen de cartera se actualiza automáticamente.

