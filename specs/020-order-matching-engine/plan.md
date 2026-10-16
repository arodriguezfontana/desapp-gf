# Implementation Plan: Superusuario y motor de matching de órdenes

**Branch**: `020-order-matching-engine` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-order-matching-engine/spec.md`

## Summary

Agrega el campo `username` a `User` (requerido, no único, salvo el valor reservado
`"superuser"` que responde 409). El seed crea al superusuario (vía un seed service
idempotente, igual que `AdminSeedService`), le carga holdings de 100 tokens por cada
jugador del catálogo y le publica una `Order` SELL por jugador al precio de su propia
estrategia seleccionada. Introduce `POST /orders` (JWT): recibe `side`, `playerId`,
`quantity` — nunca precio —, calcula el precio con `QuotationService.valuate` (el mismo
cálculo que `GET /players/:id/valuation`) y ejecuta un motor de matching exacto por
precio, FIFO, con fills parciales, dentro de una transacción con locking ordenado.
**Esta feature construye desde cero la infraestructura de holdings/transacciones de
tokens** (`TokenHolding`, `TokenTransaction`), porque 017-buy-tokens nunca se implementó
(`PortfolioService` es hoy un stub) — no hay nada que reutilizar ahí más allá de la
clase de UI `Holding` existente, que se deja intacta. Introduce además el primer uso de
transacciones y locking explícito de TypeORM en este codebase (no hay precedente).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node.js 20

**Primary Dependencies**: NestJS 11, TypeORM, class-validator, `@nestjs/swagger`; React 19 + Vite 8 + Tailwind 4 en frontend

**Storage**: PostgreSQL vía TypeORM. Nuevas tablas `token_holdings`, `token_transactions`, `orders`; nueva columna `username` en `users`

**Testing**: Jest + supertest + Testcontainers + tsarch (backend); Vitest + React Testing Library (frontend)

**Target Platform**: Linux server (backend), navegador web responsivo (frontend)

**Project Type**: Web application (monorepo `backend/` + `frontend/`)

**Performance Goals**: Sin objetivo numérico nuevo; `POST /orders` (cálculo de precio + matching + persistencia) debe completar dentro del timeout HTTP estándar del backend

**Constraints**: Match exacto de precio (sin rangos), FIFO entre candidatas, precio redondeado a 2 decimales antes de persistir/comparar (ver spec Clarifications), sin edición de precio ni cancelación de órdenes (ambas fuera de alcance), sin chequeo de fondos en BUY, consumo atómico/serializado de la cantidad pendiente de una orden bajo concurrencia

**Scale/Scope**: 1 superusuario fijo por sistema; N órdenes SELL iniciales (una por jugador del catálogo) generadas por el seed; volumen de `Order`/`TokenTransaction` crece con cada `POST /orders` y cada fill

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (capas)**: Cumple — `OrdersController` solo habla con `OrdersService`;
  `OrdersService` orquesta `QuotationService` (para el precio), `OrderRepository` y
  `TokenHoldingRepository`/`TokenTransactionRepository`, sin contener el algoritmo de
  matching (vive en dominio, `src/domain/orders/match-order.ts`, puro, sin TypeORM).
  Persistencia nueva (`OrderEntity`, `TokenHoldingEntity`, `TokenTransactionEntity`) vive
  en `src/repositories/orders/entities/` y `src/repositories/portfolio/entities/` con sus
  mappers; el Service nunca ve esas entidades.
- **Principio II (dominio rico)**: Cumple — el matching (compatibilidad de precio exacto,
  FIFO, fills parciales, remanente) es lógica de negocio y vive en una función/clase de
  dominio pura (`matchOrder(newOrder, candidates): MatchResult`), testeable sin NestJS ni
  DB. No introduce una nueva "estrategia" Strategy-pattern (el precio ya se resuelve vía
  `ValuationStrategy` existente de 019); el matching no es ese patrón, es un algoritmo de
  dominio determinista.
- **Principio III (validación por nivel)**: Cumple — DTO (`CreateOrderDto`) valida forma
  (`side` enum, `playerId` UUID, `quantity` entero positivo); Service valida existencia
  (jugador existe, usuario existe — reutiliza `PlayerRepository`/`QuotationService`) y
  precondición de negocio accesible desde fuera (holding suficiente para SELL, ver
  FR-010); dominio valida invariantes puras (cantidad > 0, no fillear más de lo
  disponible). Errores de dominio propios (`InsufficientHoldingError` → 400,
  `PlayerNotFoundError` ya existente → 404) vía `AllExceptionsFilter` existente.
- **Principio IV (autenticación)**: Cumple — `POST /orders` es `JwtAuthGuard` (operación
  ligada a un usuario individual). El registro (`POST /auth/register`) sigue sin guard,
  sin cambios; el username reservado se valida en `AuthService.register`, no agrega
  superficie de autenticación nueva.
- **Principio V (auditoría inmutable)**: Aplica directamente — cada `TokenTransaction`
  (CREDIT/DEBIT) es en sí misma el asiento de auditoría append-only de la operación de
  compra/venta de tokens exigido por este principio: autor (`userId`), timestamp
  (`createdAt`), y el detalle del cambio como campo propio (`orderId`, `counterpartOrderId`,
  `playerId`, `quantity`, `price`), no inferido comparando estados. `TokenTransaction` MUST
  NOT exponer ningún método de edición ni borrado.
- **Principio VI (integridad transaccional)**: Aplica de lleno — un matching ejecuta en
  una única transacción (`DataSource.transaction` / `queryRunner`): actualizar
  `remainingQuantity`/`status` de cada orden tocada, mover ambos `TokenHolding`, insertar
  el par de `TokenTransaction`, y (si queda remanente) insertar la nueva `Order` PENDING.
  Todo o nada. La función de dominio que decide qué cambios aplicar vive en
  `src/domain/orders/match-order.ts` (puro); el `OrdersService` es quien abre la
  transacción, pide el plan de cambios al dominio, y los persiste atómicamente — cumple
  "vive en el dominio, no en el Service" en el sentido de que el dominio decide el *qué*
  (plan de fills) y garantiza su propia correción (invariantes de cantidades); el Service
  es responsable de la mecánica de persistencia transaccional, que no tiene equivalente
  de dominio sin TypeORM (ver research.md D4 para la discusión de este límite).
- **Principio VII (observabilidad)**: Sin cambios de diseño nuevos; se reutiliza logging
  estructurado y Correlation ID ya existentes. `OrdersService` loguea cada ejecución de
  matching (orderId, counterpartOrderId, quantity, price) sin datos personales.
- **Principio VIII (Swagger)**: Pendiente de generar desde los nuevos DTOs/decoradores de
  `OrdersController` en Phase 1 (no se escribe a mano).
- **Principio IX (testing)**: Plan incluye tests de dominio sin NestJS/DB para
  `matchOrder` (FIFO, fill completo, fill parcial multi-contraparte, sin match, mismo
  usuario en ambos lados), tests de integración con Testcontainers para
  `POST /orders` (incluyendo el escenario de concurrencia de FR-021/SC-008: dos
  creaciones simultáneas que compiten por la misma orden existente), test de
  `AuthService.register` rechazando `"superuser"`, test del seed service, y tsarch sigue
  corriendo sin cambios de capas (los nuevos directorios ya respetan el patrón existente).
- **Principio X (Decimal)**: Cumple — `price` en `orders` y `amount`/`price` en
  `token_transactions` MUST ser `DECIMAL(10,2)` (convención "valor/precio de token" ya
  definida en la constitución), nunca `float`/`double`. `quantity`/`remainingQuantity` en
  `orders` y en `token_holdings` son enteros (`integer`), no decimales (cantidad de
  tokens, unidades enteras — ver spec Assumptions).
- **Principio XI (idioma)**: Identificadores en inglés (`Order`, `TokenHolding`,
  `matchOrder`), mensajes de error y nombres de dominio conceptual en español
  (`SaldoInsuficienteError` → en código: `InsufficientHoldingError` con mensaje en
  español), consistente con el código existente (p. ej. `EmailAlreadyInUseError` con
  mensajes en español).
- **Principio XII (spec-first)**: Cumple — toda ambigüedad resuelta en `spec.md` bajo
  `## Clarifications` antes de este plan (precisión de precio, fondos en BUY, alcance de
  cancelación, concurrencia).

**Desviación a documentar (no es una violación, es un límite real del principio VI)**:
no existe en este codebase ningún precedente de transacción/lock explícito de TypeORM
(`research.md` D4 lo confirma); esta feature lo introduce por primera vez. Se documenta
en `Complexity Tracking` como una decisión nueva, no una excepción a un patrón existente
que se esté evitando.

Sin violaciones de principios. Se documenta una única entrada en `Complexity Tracking`
por ser la primera vez que se introduce un patrón (transacciones/locking explícito), no
por desviarse de una regla.

## Project Structure

### Documentation (this feature)

```text
specs/020-order-matching-engine/
├── plan.md              # Este archivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   └── orders-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks, no generado por /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── auth/
│   │   │   ├── user.ts                        # + username: string
│   │   │   ├── username.ts                    # nuevo VO: Username.create(raw) — requerido, sin validación de formato adicional
│   │   │   └── errors/
│   │   │       └── reserved-username.error.ts # nuevo: 409 al intentar "superuser"
│   │   ├── portfolio/
│   │   │   ├── holding.ts                     # SIN CAMBIOS (read-model de UI existente, no se reutiliza)
│   │   │   ├── token-holding.ts                # nuevo: entidad de dominio pura (userId, playerId, quantity)
│   │   │   └── errors/
│   │   │       └── insufficient-holding.error.ts  # nuevo: 400 al vender más de lo que se tiene
│   │   └── orders/
│   │       ├── order.ts                        # nuevo: entidad de dominio (id, userId, playerId, side, quantity, remainingQuantity, price, status, createdAt)
│   │       ├── order-side.ts                    # nuevo: enum BUY | SELL
│   │       ├── order-status.ts                  # nuevo: enum PENDING | PARTIALLY_FILLED | COMPLETED
│   │       ├── match-order.ts                   # nuevo: función pura de matching (FIFO, fill completo/parcial, remanente)
│   │       ├── token-transaction.ts             # nuevo: entidad de dominio (CREDIT | DEBIT)
│   │       └── errors/
│   │           └── player-not-found.error.ts   # reutiliza el existente de `quotation`/`player` si ya cubre el caso (ver research.md)
│   ├── services/
│   │   ├── auth/
│   │   │   ├── auth.service.ts                  # register() valida Username.create (409 ReservedUsernameError)
│   │   │   └── superuser-seed.service.ts        # nuevo: idempotente, mismo patrón que AdminSeedService — crea superuser, holdings, órdenes SELL iniciales
│   │   └── orders/
│   │       └── orders.service.ts                 # nuevo: createOrder(userId, playerId, side, quantity) — precio vía QuotationService, matching transaccional
│   ├── controllers/
│   │   ├── auth/
│   │   │   └── dto/register-request.dto.ts       # + username (string, requerido, class-validator)
│   │   └── orders/
│   │       ├── orders.controller.ts              # nuevo: POST /orders (JwtAuthGuard)
│   │       └── dto/
│   │           ├── create-order-request.dto.ts
│   │           └── order-response.dto.ts
│   ├── repositories/
│   │   ├── auth/
│   │   │   ├── entities/user.entity.ts           # + username column
│   │   │   └── mappers/user.mapper.ts            # + username
│   │   ├── portfolio/                             # nuevo directorio (hoy no existe)
│   │   │   ├── entities/token-holding.entity.ts
│   │   │   ├── mappers/token-holding.mapper.ts
│   │   │   ├── token-holding.repository.ts        # interfaz
│   │   │   └── typeorm-token-holding.repository.ts
│   │   └── orders/
│   │       ├── entities/order.entity.ts
│   │       ├── entities/token-transaction.entity.ts
│   │       ├── mappers/order.mapper.ts
│   │       ├── mappers/token-transaction.mapper.ts
│   │       ├── order.repository.ts                # interfaz
│   │       ├── typeorm-order.repository.ts
│   │       ├── token-transaction.repository.ts    # interfaz
│   │       └── typeorm-token-transaction.repository.ts
│   ├── database/migrations/
│   │   ├── <timestamp>-AddUsernameToUsers.ts
│   │   ├── <timestamp>-CreateTokenHoldings.ts
│   │   ├── <timestamp>-CreateOrders.ts
│   │   └── <timestamp>-CreateTokenTransactions.ts
│   ├── modules/
│   │   ├── auth/auth.module.ts                    # sin cambios de wiring (Username VO no tiene DI)
│   │   ├── portfolio/portfolio.module.ts          # + TypeOrmModule.forFeature([TokenHoldingEntity]), exporta TOKEN_HOLDING_REPOSITORY
│   │   └── orders/
│   │       ├── orders.module.ts                    # nuevo
│   │       └── orders.constants.ts                 # ORDER_REPOSITORY, TOKEN_TRANSACTION_REPOSITORY
│   └── main.ts                                     # + await app.get(SuperuserSeedService, { strict: false }).run(); (después de AdminSeedService)
└── test/
    └── (e2e nuevos: orders-create, orders-matching, superuser-seed, register-reserved-username)

frontend/
├── src/
│   ├── service/
│   │   └── ordersService.ts                       # nuevo: createOrder(side, playerId, quantity)
│   ├── hooks/
│   │   └── useCreateOrder.ts                       # nuevo
│   ├── pages/
│   │   └── PlayerDetailPage.tsx                     # + botones "Comprar"/"Vender" junto al "Valor token" existente (línea ~199-232)
│   ├── components/
│   │   └── OrderConfirmDialog.tsx                   # nuevo: muestra el precio de la estrategia seleccionada antes de confirmar
│   └── types/
│       └── orders.types.ts                          # nuevo
└── test/
    └── ordersService.test.tsx                       # nuevo, contra backend real + Testcontainers (Principio IX)
```

**Structure Decision**: Se mantiene la estructura por capas ya vigente en `backend/src/`
(Principio I) y `frontend/src/` (sección Estructura de la constitución). Los directorios
`src/modules/orders/`, `src/controllers/orders/`, `src/services/orders/`,
`src/repositories/orders/` y `src/domain/orders/` ya existen vacíos (pre-scaffoldeados);
esta feature los puebla sin crear ningún nuevo directorio de alto nivel fuera de ese
scaffold. El único directorio nuevo no pre-existente es `src/repositories/portfolio/`
(para `TokenHolding`), porque 017-buy-tokens nunca llegó a crearlo.

## Complexity Tracking

| Decisión nueva | Por qué se necesita | Alternativa más simple descartada porque |
|-----------------|----------------------|-------------------------------------------|
| Transacción + locking explícito de TypeORM (primer uso en el codebase) | El matching mueve `remainingQuantity` de N órdenes y 2 `TokenHolding` a la vez (Principio VI); sin esto, dos `POST /orders` concurrentes podrían sobre-fillear la misma orden (spec FR-021) | Un lock en memoria (como el de `QuotationService.recalculate`, por `userId`) no alcanza: el matching involucra órdenes y holdings de *dos* usuarios distintos, y la app puede escalar a más de una instancia — un lock en memoria de un solo proceso no sirve entre instancias ni protege la fila en DB de otra transacción concurrente |
