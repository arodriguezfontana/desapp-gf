# Feature Specification: Cancelación de Órdenes (Order Cancellation)

**Feature Branch**: `023-cancel-order`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Como el precio de una orden se genera automáticamente con la estrategia del usuario al momento de crearla y no se puede editar, la única forma de cambiar de opinión sobre una orden que todavía no se ejecutó es cancelarla y crear una nueva. DELETE /orders/:id cancela una orden propia. Solo puede cancelarla el usuario que la creó (403 si no es el dueño); solo se puede cancelar si está PENDING o PARTIALLY_FILLED (409 si ya está COMPLETED o ya CANCELLED); 404 si el id no existe. Al cancelar, la orden pasa a CANCELLED y su remainingQuantity deja de estar disponible para matchear contra futuras órdenes. Si la orden era de venta (SELL) y tenía tokens reservados implícitamente (su remainingQuantity restaba del disponible del vendedor para crear nuevas órdenes), cancelarla libera esa cantidad — vuelve a estar disponible para que el usuario la ofrezca en una nueva orden. La decisión de diseño a documentar es que la cancelación es la única vía de escape para cambiar el precio de una orden — no existe edición de órdenes, solo cancelar y volver a crear. Queda fuera de alcance, aceptado como riesgo: no hay límite de tiempo para cancelar una orden PARTIALLY_FILLED — puede quedar así indefinidamente si el usuario nunca la cancela ni se termina de completar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cancelación exitosa de orden pendiente o parcialmente ejecutada (Priority: P1)

Como usuario inversor con órdenes activas en el mercado de tokens, quiero poder cancelar una orden propia que todavía no terminó de ejecutarse (`PENDING` o `PARTIALLY_FILLED`) para retirar mi oferta o demanda del libro de órdenes y, en caso de ser una venta, recuperar la disponibilidad de mis tokens reservados para utilizarlos en una nueva orden.

**Why this priority**: Es la funcionalidad central requerida. Dado que los precios de las órdenes son inmutables al momento de creación, la cancelación constituye el único mecanismo que tiene un usuario para desistir de una operación o ajustar su estrategia de mercado.

**Independent Test**: Puede probarse creando una orden de compra o venta, invocando `DELETE /orders/:id` y verificando que la orden pasa a estado `CANCELLED`, que su remanente ya no se cruza contra órdenes contrarias y que los tokens de una orden de venta vuelven a estar disponibles.

**Acceptance Scenarios**:

1. **Given** una orden propia en estado `PENDING` (de compra o de venta), **When** el usuario propietario envía `DELETE /orders/:id`, **Then** el sistema cancela la orden, actualiza su estado a `CANCELLED`, excluye su `remainingQuantity` del libro de órdenes y responde exitosamente con HTTP 200 o 204.
2. **Given** una orden propia de venta (`SELL`) en estado `PENDING` o `PARTIALLY_FILLED` con `remainingQuantity > 0`, **When** el usuario propietario la cancela exitosamente, **Then** los tokens que estaban implícitamente retenidos por el remanente de esa venta se liberan de inmediato, incrementando el saldo disponible del usuario para crear nuevas órdenes de venta.
3. **Given** una orden propia en estado `PARTIALLY_FILLED` que ya tuvo ejecuciones parciales (fills), **When** el usuario propietario la cancela, **Then** las transacciones y traspasos de tokens ya ejecutados previamente permanecen intactos y confirmados, la orden pasa a estado `CANCELLED` y el remanente no ejecutado (`remainingQuantity`) deja de estar disponible para futuros matches.
4. **Given** una orden cancelada, **When** ingresan nuevas órdenes al mercado con precios y cantidades compatibles, **Then** el motor de matching ignora completamente la orden cancelada y no genera ningún intercambio sobre ella.

---

### User Story 2 - Control de acceso y pertenencia de la orden (Priority: P2)

Como plataforma financiera, necesito restringir la cancelación de órdenes exclusivamente al usuario propietario de las mismas, para garantizar la integridad del mercado y evitar manipulaciones no autorizadas sobre órdenes ajenas.

**Why this priority**: Garantiza la seguridad y privacidad del sistema. Un usuario nunca debe poder cancelar, sabotear o interferir con las órdenes colocadas por otros participantes del mercado.

**Independent Test**: Puede verificarse autenticándose con un usuario `A`, intentando cancelar una orden creada por un usuario `B`, y comprobando que el sistema responde con error 403 Forbidden sin alterar la orden.

**Acceptance Scenarios**:

1. **Given** una orden perteneciente al usuario `B`, **When** el usuario `A` envía una petición `DELETE /orders/:id`, **Then** el sistema rechaza la solicitud con código HTTP 403 (Forbidden) y el estado de la orden de `B` permanece inalterado.
2. **Given** una petición `DELETE /orders/:id` enviada sin credenciales de autenticación o con un token JWT vencido o inválido, **When** el servidor procesa la solicitud, **Then** el sistema rechaza la petición con código HTTP 401 (Unauthorized).

---

### User Story 3 - Manejo de estados terminales y órdenes inexistentes (Priority: P3)

Como usuario o sistema cliente, quiero recibir respuestas de error claras y predecibles cuando intento cancelar una orden que ya no se encuentra en un estado cancelable o cuyo identificador no existe en el sistema.

**Why this priority**: Proporciona consistencia operativa y evita ambigüedades en la sincronización del estado del mercado y la interfaz de usuario ante reintentos o acciones redundantes.

**Independent Test**: Puede verificarse intentando cancelar una orden con un ID inexistente (debe dar 404), una orden en estado `COMPLETED` (debe dar 409 Conflict) y una orden previamente `CANCELLED` (debe dar 409 Conflict).

**Acceptance Scenarios**:

1. **Given** un identificador de orden que no corresponde a ninguna orden registrada, **When** el usuario solicita `DELETE /orders/:id`, **Then** el sistema responde con código HTTP 404 (Not Found).
2. **Given** una orden propia que ya fue ejecutada en su totalidad (`COMPLETED`), **When** el usuario solicita su cancelación mediante `DELETE /orders/:id`, **Then** el sistema rechaza la operación respondiendo con código HTTP 409 (Conflict).
3. **Given** una orden propia que ya fue cancelada con anterioridad (`CANCELLED`), **When** el usuario solicita cancelarla nuevamente, **Then** el sistema rechaza la operación respondiendo con código HTTP 409 (Conflict).

---

### Edge Cases

- **Concurrencia entre matching y cancelación**: Si una orden compatible ingresa al motor de matching al mismo tiempo que el propietario solicita su cancelación, el bloqueo pesimista en la transacción de cancelación debe resolver la condición de carrera:
  - Si el match se procesa primero y completa la orden (`COMPLETED`), la posterior cancelación fallará con 409 Conflict.
  - Si el match es parcial antes de que se adquiera el bloqueo de cancelación, la cancelación se aplicará sobre el remanente actualizado.
  - Si la cancelación se procesa primero, el match no considerará la orden cancelada.
- **Formato de identificador no válido**: Si el parámetro `:id` no cumple el formato esperado (UUID v4), el sistema responde con código HTTP 400 (Bad Request).
- **Cancelación sobre orden `PARTIALLY_FILLED` sin reversión de historial**: La cancelación no revierte ni anula los registros de `TokenTransaction` ya generados por los matches parciales previos; el historial de transacciones se mantiene inmutable y fidedigno.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer el endpoint `DELETE /orders/:id` protegido por autenticación JWT.
- **FR-002**: El sistema DEBE validar que el identificador `:id` provisto corresponda a una orden existente; en caso contrario, DEBE responder con código HTTP 404 (Not Found).
- **FR-003**: El sistema DEBE verificar que el usuario autenticado sea el creador (`userId`) de la orden solicitada; si el usuario no es el propietario, DEBE responder con código HTTP 403 (Forbidden).
- **FR-004**: El sistema DEBE permitir la cancelación únicamente si la orden se encuentra en estado `PENDING` o `PARTIALLY_FILLED`.
- **FR-005**: Si la orden se encuentra en estado `COMPLETED` o `CANCELLED`, el sistema DEBE rechazar la cancelación respondiendo con código HTTP 409 (Conflict).
- **FR-006**: Al cancelar una orden, el sistema DEBE actualizar su estado de dominio a `CANCELLED`.
- **FR-007**: El remanente (`remainingQuantity`) de una orden en estado `CANCELLED` DEBE ser excluido inmediatamente del libro de órdenes, no pudiendo ser seleccionado ni bloqueado por el motor de matching para cruces futuros.
- **FR-008**: Si la orden cancelada era de venta (`side = SELL`), el sistema DEBE liberar de inmediato el remanente no ejecutado (`remainingQuantity`) del cómputo de tokens reservados, aumentando el saldo disponible del usuario para emitir nuevas órdenes de venta.
- **FR-009**: Al cancelar una orden en estado `PARTIALLY_FILLED`, el sistema DEBE preservar sin modificaciones todas las operaciones y transferencias de tokens ya concretadas por dicha orden.
- **FR-010**: La operación de cancelación DEBE ejecutarse de forma atómica y bajo control de concurrencia para evitar discrepancias con ejecuciones concurrentes de matching.
- **FR-011**: El sistema NO DEBE permitir la edición ni modificación de campos en órdenes existentes; la cancelación y posterior creación de una nueva orden constituye el único camino provisto para alterar las condiciones de una orden.

### Key Entities *(include if feature involves data)*

- **Order (Orden)**: Representa la oferta o demanda de tokens de un jugador en el mercado. Atributos clave: identificador único (`id`), usuario creador (`userId`), jugador objetivo (`playerId`), sentido (`side`: BUY o SELL), cantidad original (`quantity`), cantidad remanente pendiente (`remainingQuantity`), precio unitario (`price`), estado (`status`: PENDING, PARTIALLY_FILLED, COMPLETED, CANCELLED) y fecha de creación (`createdAt`).
- **TokenHolding (Posición de Tokens)**: Representa la tenencia de tokens de un jugador por parte de un usuario. Su disponibilidad neta para ventas se calcula como la cantidad total del holding menos la suma de las cantidades pendientes (`remainingQuantity`) de las órdenes de venta activas (`PENDING` o `PARTIALLY_FILLED`). La transición de una orden a `CANCELLED` la excluye de esta suma, liberando la disponibilidad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las solicitudes de cancelación de órdenes propias se procesan con respuesta exitosa en menos de 500 ms bajo carga normal de desarrollo.
- **SC-002**: El 100% de las órdenes canceladas quedan inmediatamente excluidas de las consultas de candidatos del motor de matching; cero órdenes en estado `CANCELLED` participan en matches futuros.
- **SC-003**: El 100% de la cantidad remanente (`remainingQuantity`) de una orden de venta cancelada queda liberada y disponible de inmediato para nuevas órdenes de venta del usuario.
- **SC-004**: El 100% de los intentos de cancelación inválidos (orden ajena, id inexistente, orden completada o previamente cancelada) son rechazados con los códigos HTTP correspondientes (403, 404, 409).

## Assumptions

- **Inmutabilidad y no-edición**: Se asume y documenta explícitamente que no existe soporte para modificar o editar órdenes existentes; el usuario que desee modificar el precio o volumen de una orden no ejecutada debe cancelarla y crear una nueva orden.
- **Riesgo aceptado - Ausencia de TTL**: Se asume y acepta como riesgo fuera de alcance que no existe vencimiento temporal automático para órdenes en estado `PENDING` o `PARTIALLY_FILLED`. Una orden puede permanecer en estado `PARTIALLY_FILLED` indefinidamente si no se cancela ni se completa.
- **Reserva en órdenes de compra**: Las órdenes de compra (`BUY`) no bloquean saldo monetario en cuenta corriente (el modelo de dominio actual de la plataforma no mantiene balances de divisa fiduciaria por usuario). Por lo tanto, la cancelación de una orden `BUY` no requiere liberar fondos, únicamente retira la orden del libro.
- **Persistencia del historial**: La orden cancelada no se elimina físicamente de la base de datos (hard delete), sino que se preserva con estado `CANCELLED` para fines de trazabilidad e historial.
