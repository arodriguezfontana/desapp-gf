# Research: Cancelación de Órdenes (Order Cancellation)

**Feature**: `023-cancel-order`  
**Date**: 2026-10-21  

---

## D1: Verbo HTTP y semántica REST para la cancelación

* **Decisión**: Exponer `DELETE /orders/:id` para cancelar una orden propia, respondiendo con `200 OK` (devolviendo la orden en su estado `CANCELLED`) o `204 No Content`.
* **Rationale**: El requerimiento del usuario estipula taxativamente `DELETE /orders/:id`. En la plataforma no existe edición de órdenes (precio inmutable por valuación de estrategia, cantidad fija); la cancelación es la retirada definitiva de la orden del mercado. `DELETE` expresa fielmente la revocación de la intención de compra o venta sin abrir la puerta a un endpoint genérico de edición como `PATCH`.
* **Alternativas consideradas**:
  * `PATCH /orders/:id` con `{ status: "CANCELLED" }`: Descartada explícitamente por el usuario para enfatizar que no existe modificación de órdenes.
  * `POST /orders/:id/cancel`: Descartada en favor del verbo canónico `DELETE /orders/:id` indicado en la especificación.

---

## D2: Control de concurrencia y bloqueo entre cancelación y matching engine

* **Decisión**: Ejecutar la cancelación dentro de una transacción gestionada por `TransactionManager.run()` adquiriendo un bloqueo pesimista de escritura (`pessimistic_write` / `SELECT ... FOR UPDATE`) sobre la fila de la orden en la tabla `orders`.
* **Rationale**: En el motor de matching de órdenes (feature `020-order-matching-engine`), cuando ingresa una nueva orden al libro, el sistema adquiere bloqueos pesimistas sobre todas las órdenes compatibles candidatas (`lockCompatibleCandidates`). Si un usuario cancela una orden en el mismo milisegundo en que otra orden intenta matchear contra ella:
  * Si el lock lo gana el matching engine: el cruce se procesa. Si el cruce consume la totalidad de la orden, su estado pasa a `COMPLETED`. Cuando el proceso de cancelación toma el control tras liberarse el lock, lee la orden como `COMPLETED` y rechaza la cancelación con `409 Conflict`. Si el cruce fue parcial, la orden queda `PARTIALLY_FILLED` con un `remainingQuantity` menor; la cancelación cancela ese remanente.
  * Si el lock lo gana la cancelación: la orden pasa a `CANCELLED`. Cuando el matching engine toma el control, la orden ya no califica como candidata abierta (`status` no está en `OPEN_STATUSES`), evitando sobre-ejecuciones.
* **Alternativas consideradas**:
  * *Optimistic locking con columna version*: Descartada porque el resto del subsistema de órdenes ya utiliza transacciones con bloqueo pesimista en PostgreSQL.
  * *Cancelación sin lock transaccional*: Descartada por alto riesgo de condición de carrera (filleo de una orden recién cancelada o doble ejecución).

---

## D3: Liberación de tokens reservados para órdenes SELL

* **Decisión**: La liberación de tokens opera de forma automática mediante la exclusión de la orden cancelada del conjunto `OPEN_STATUSES = ['PENDING', 'PARTIALLY_FILLED']`.
* **Rationale**: En la arquitectura actual (`TypeOrmOrderRepository.sumPendingSellQuantity`), el saldo retenido para ventas no se almacena como una columna redundante en `token_holdings`, sino que se calcula dinámicamente sumando `remaining_quantity` de todas las órdenes del usuario donde `side = 'SELL'` y `status IN ('PENDING', 'PARTIALLY_FILLED')`. Al transicionar la orden a `CANCELLED`, la consulta SQL la ignora de forma inmediata.
* **Impacto en el dominio**: No se requiere debitar ni acreditar tokens en `token_holdings` al cancelar, manteniendo la pureza y simplicidad del modelo.

---

## D4: Listado de órdenes del usuario (`GET /orders`) para "Mis órdenes"

* **Decisión**: Agregar el endpoint `GET /orders` en `OrdersController` (protegido por JWT) que devuelva el listado de órdenes pertenecientes al usuario autenticado (`userId`), ordenadas por fecha de creación descendente (`createdAt DESC`).
* **Rationale**: Para que el usuario pueda visualizar el botón "Cancelar" en la interfaz de usuario en la sección "Mis órdenes", el frontend debe poder consultar no solo las transacciones históricas (`GET /orders/history`), sino las órdenes vigentes con sus respectivos estados (`PENDING`, `PARTIALLY_FILLED`, `COMPLETED`, `CANCELLED`) y remanentes.
* **Alternativas consideradas**:
  * Embeber las órdenes abiertas dentro del snapshot de `GET /users/:id/portfolio`: Descartada para mantener la cohesión de `PortfolioModule` (enfocado en métricas y holdings) y `OrdersModule` (enfocado en el ciclo de vida de órdenes).

---

## D5: Integración y experiencia en Frontend

* **Decisión**:
  * Crear el componente `MyOrders.tsx` e integrarlo en la vista de `PortfolioPage.tsx` (debajo de `HoldingList` y junto a `OperationHistory`).
  * Implementar el custom hook `useUserOrders` que maneje el fetching de órdenes y la acción `cancelOrder(id)`.
  * Mostrar el botón "Cancelar" únicamente cuando `order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED'`.
  * Al hacer clic en "Cancelar", solicitar confirmación al usuario (mediante modal o botón de acción rápida con estado de carga), invocar `ordersService.cancelOrder(id)` y refrescar tanto la lista de órdenes como los holdings del portfolio.
* **Rationale**: Ofrece una visualización clara del estado de las posturas del usuario y permite cancelar rápidamente órdenes no deseadas.

