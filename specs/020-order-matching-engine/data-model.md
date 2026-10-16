# Data Model: Superusuario y motor de matching de órdenes

## Entidades de dominio

### User *(extiende, ver 001-user-auth)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Sin cambios |
| `email` | `Email` | Sin cambios |
| `passwordHash` | `string` | Sin cambios |
| **`username`** *(nuevo)* | `string` | Requerido. Sin unicidad salvo el valor reservado `"superuser"`. Validado solo contra ese valor reservado (`Username.create`); cualquier otro string no vacío es válido, incluso repetido entre usuarios. |
| `createdAt` | `Date` | Sin cambios |
| `role` | `UserRole` | Sin cambios |

**Invariantes de dominio**:
- `username` MUST NOT ser exactamente `"superuser"` salvo para el único usuario
  provisto por `SuperuserSeedService` — la invariante se garantiza por aplicación
  (`AuthService.register` rechaza con `ReservedUsernameError`, 409), no por constraint de
  esquema (la columna no es `UNIQUE`).

---

### TokenHolding *(nuevo — infraestructura de 017-buy-tokens construida por esta feature)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | — |
| `userId` | `string` (UUID) | Dueño del holding |
| `playerId` | `string` (UUID) | Jugador al que corresponde |
| `quantity` | `number` (entero, ≥ 0) | Cantidad de tokens de ese jugador que posee el usuario |
| `updatedAt` | `Date` | Último movimiento |

**Invariantes de dominio**:
- `quantity >= 0` siempre — nunca puede quedar negativo tras un débito (una venta válida
  ya se validó contra el `quantity` disponible antes de ejecutarse, FR-010; el dominio
  además lo re-verifica como invariante de último recurso).
- Existe como máximo un `TokenHolding` por par `(userId, playerId)` — un crédito/débito
  es un upsert sobre esa fila, nunca una fila nueva.

**Métodos de dominio**:
- `static createEmpty(userId, playerId)` — holding inicial en 0.
- `credit(quantity)` — devuelve nueva instancia con `quantity` incrementada.
- `debit(quantity)` — devuelve nueva instancia con `quantity` decrementada; lanza
  `InsufficientHoldingError` si `quantity` resultante sería negativa.

---

### Order *(nuevo)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | — |
| `userId` | `string` (UUID) | Quien publicó la orden |
| `playerId` | `string` (UUID) | Jugador de la orden |
| `side` | `OrderSide` (`BUY` \| `SELL`) | — |
| `quantity` | `number` (entero > 0) | Cantidad original pedida, inmutable |
| `remainingQuantity` | `number` (entero ≥ 0) | Cantidad aún no ejecutada; decrece con cada fill |
| `price` | `number` (2 decimales) | Calculado automáticamente al crear la orden (nunca indicado por el usuario); inmutable una vez creada, incluso si la estrategia del usuario cambia después |
| `status` | `OrderStatus` (`PENDING` \| `PARTIALLY_FILLED` \| `COMPLETED`) | `PENDING` al nacer si `remainingQuantity = quantity`; `PARTIALLY_FILLED` si `0 < remainingQuantity < quantity`; `COMPLETED` si `remainingQuantity = 0` |
| `createdAt` | `Date` | Usado para el orden FIFO del matching |

**Invariantes de dominio**:
- `0 <= remainingQuantity <= quantity` siempre.
- `price` MUST NOT cambiar después de creada (sin método de edición expuesto, DD-003 de
  la spec).
- `status` se deriva siempre de `remainingQuantity` vs `quantity` — no es un campo que
  se setee independientemente, para que nunca quede inconsistente.

**Métodos de dominio**:
- `static create({ id, userId, playerId, side, quantity, price, createdAt })` —
  `remainingQuantity = quantity`, `status = PENDING`.
- `fill(quantity)` — devuelve nueva instancia con `remainingQuantity` decrementado y
  `status` recalculado; lanza error de invariante si `quantity > remainingQuantity`.
- `isCompatibleWith(other: Order): boolean` — `true` solo si `side` opuesto, mismo
  `playerId`, mismo `price` exacto (ambos ya redondeados a 2 decimales) y
  `other.remainingQuantity > 0`.

---

### TokenTransaction *(nuevo — infraestructura de 017-buy-tokens construida por esta feature)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | — |
| `userId` | `string` (UUID) | A quién afecta este movimiento (comprador en el CREDIT, vendedor en el DEBIT) |
| `type` | `TokenTransactionType` (`CREDIT` \| `DEBIT`) | — |
| `playerId` | `string` (UUID) | — |
| `quantity` | `number` (entero > 0) | Cantidad movida en esta porción ejecutada |
| `price` | `number` (2 decimales) | Precio exacto al que se ejecutó esta porción (el precio de match) |
| `orderId` | `string` (UUID) | La orden propia de este `userId` que generó el movimiento |
| `counterpartOrderId` | `string` (UUID) | La orden de la contraparte en esta ejecución |
| `createdAt` | `Date` | — |

**Invariantes de dominio**:
- Inmutable tras creación — sin método de edición ni borrado (Principio V, auditoría
  inmutable).
- Toda ejecución de matching genera exactamente un par: un `TokenTransaction` `CREDIT`
  (comprador) y un `TokenTransaction` `DEBIT` (vendedor), con el mismo `quantity`,
  `price`, `playerId` y timestamp de ejecución, pero `orderId`/`counterpartOrderId`
  cruzados entre sí.

---

## Esquema de persistencia (TypeORM)

### `users` (cambio sobre la entidad existente)

| Columna | Tipo | Notas |
|---|---|---|
| ... | ... | columnas existentes sin cambios |
| **`username`** *(nueva)* | `varchar(255) NOT NULL` | Sin índice único. Backfill para filas existentes: ver Migraciones. |

### `token_holdings` *(nueva tabla)*

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | — |
| `user_id` | `uuid NOT NULL` | `FK → users(id) ON DELETE CASCADE` |
| `player_id` | `uuid NOT NULL` | `FK → players(id)` (o la tabla de catálogo vigente) |
| `quantity` | `integer NOT NULL DEFAULT 0` | `CHECK (quantity >= 0)` |
| `updated_at` | `timestamptz NOT NULL` | — |

Índice único compuesto `UNIQUE (user_id, player_id)` — un holding por par usuario/jugador.

### `orders` *(nueva tabla)*

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | — |
| `user_id` | `uuid NOT NULL` | `FK → users(id)` |
| `player_id` | `uuid NOT NULL` | `FK → players(id)` |
| `side` | `varchar(4) NOT NULL` | `BUY` \| `SELL` |
| `quantity` | `integer NOT NULL` | `CHECK (quantity > 0)` |
| `remaining_quantity` | `integer NOT NULL` | `CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity)` |
| `price` | `decimal(10,2) NOT NULL` | Convención "valor/precio de token" de la constitución (Principio X) |
| `status` | `varchar(16) NOT NULL` | `PENDING` \| `PARTIALLY_FILLED` \| `COMPLETED` |
| `created_at` | `timestamptz NOT NULL` | — |

Índice compuesto `(player_id, side, price, status, created_at)` — es exactamente el
criterio de búsqueda de candidatas del matching (mismo jugador, lado opuesto, precio
exacto, status en `PENDING`/`PARTIALLY_FILLED`, ordenado FIFO por `created_at`).

### `token_transactions` *(nueva tabla)*

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | — |
| `user_id` | `uuid NOT NULL` | `FK → users(id)` |
| `type` | `varchar(6) NOT NULL` | `CREDIT` \| `DEBIT` |
| `player_id` | `uuid NOT NULL` | `FK → players(id)` |
| `quantity` | `integer NOT NULL` | `CHECK (quantity > 0)` |
| `price` | `decimal(10,2) NOT NULL` | — |
| `order_id` | `uuid NOT NULL` | `FK → orders(id)` |
| `counterpart_order_id` | `uuid NOT NULL` | `FK → orders(id)` |
| `created_at` | `timestamptz NOT NULL` | — |

Tabla append-only: ningún repositorio expone `update`/`delete` sobre ella.

### Migraciones de esquema (orden)

1. `AddUsernameToUsers` — agrega `username varchar(255) NOT NULL`; backfill simple para
   filas existentes (p. ej. un placeholder derivado del email, ya que la spec no define
   una regla de backfill específica — se documenta como asunción en `spec.md`).
2. `CreateTokenHoldings` — nueva tabla, con índice único `(user_id, player_id)`.
3. `CreateOrders` — nueva tabla, con índice compuesto de matching.
4. `CreateTokenTransactions` — nueva tabla, con FKs a `orders`.

### Datos seed del superusuario (ver research.md D3)

- `username = "superuser"` (fijo), `email`/`password` desde `SUPERUSER_EMAIL`/
  `SUPERUSER_PASSWORD` (env vars, mismo contrato que `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
- Dos `ValuationStrategy` propias vía `UserStrategyProvisioningService` (mismos valores
  seed que cualquier alta — ver 019 data-model.md).
- Por cada jugador activo del catálogo: `TokenHolding(quantity=100)` +
  `Order(side=SELL, quantity=100, remainingQuantity=100, price=<valuate del superuser para ese jugador>, status=PENDING)`.

## State transitions

- `Order.status`: `PENDING → PARTIALLY_FILLED` (al recibir el primer fill parcial) →
  `COMPLETED` (al cubrir toda la cantidad, ya sea de una vez desde `PENDING` o
  acumulando fills desde `PARTIALLY_FILLED`). Nunca retrocede. No existe transición hacia
  un estado de cancelación en esta feature (fuera de alcance, ver spec DD-003).
- `TokenHolding.quantity`: incrementa (crédito) o decrementa (débito) con cada fill en el
  que el usuario participa como comprador o vendedor respectivamente; nunca por otra vía.
- `TokenTransaction`: solo transición `(no existe) → creada`; no hay transición
  posterior (append-only, Principio V).
