# Data Model: Snapshot de saldo en la auditoría de tokens

La feature agrega dos columnas a una tabla existente y relaja dos restricciones; no crea tablas.

## `token_transactions` (asiento de auditoría)

| Columna | Tipo | Antes | Ahora (paso 1) | Paso 2 |
|---------|------|-------|----------------|--------|
| `id` | uuid PK | — | — | — |
| `user_id` | uuid FK users | NOT NULL | — | — |
| `type` | varchar(6) `CREDIT`/`DEBIT` | NOT NULL | — | — |
| `player_id` | uuid FK players | NOT NULL | — | — |
| `quantity` | integer, `> 0` | NOT NULL | — | — |
| `price` | decimal(10,2) | NOT NULL | — | — |
| `order_id` | uuid FK orders | NOT NULL | **NULL permitido** (emisión) | — |
| `counterpart_order_id` | uuid FK orders | NOT NULL | **NULL permitido** (emisión) | — |
| `created_at` | timestamptz | NOT NULL | — | — |
| `balance_before` | integer | — | **nuevo, NULL permitido** | **NOT NULL** |
| `balance_after` | integer | — | **nuevo, NULL permitido** | **NOT NULL** |

Índice existente `(user_id, player_id, created_at)`: sirve tal cual para recorrer la cadena de una tenencia.

### Invariantes (dominio; la base sólo asegura lo marcado)

| Invariante | Dónde se aplica |
|------------|-----------------|
| `balance_before >= 0` y `balance_after >= 0` | dominio (`TokenHolding.applyDebit` ya rechaza negativos); base en el paso 2 puede sumar `CHECK` (≥ 0) |
| `CREDIT`: `balance_after = balance_before + quantity`; `DEBIT`: `balance_after = balance_before − quantity` | dominio (misma operación que produce los dos valores) |
| Cadena continua por tenencia: `balance_before` de cada asiento = `balance_after` del anterior | por construcción (cada movimiento parte de la tenencia ya modificada, bajo `FOR UPDATE`); verificada por tests y por el backfill |
| Último `balance_after` = `token_holdings.quantity` | verificada por tests y por la validación cruzada del backfill |
| Un asiento con `order_id IS NULL` es una emisión y tiene `counterpart_order_id IS NULL`, `type = CREDIT`, `balance_before = 0` | dominio (`issueInitialEmission`) |
| Los dos saldos se escriben una sola vez: al crear el asiento, o en el backfill sólo si ambos eran `NULL` | `INSERT` con valores; `UPDATE … WHERE … IS NULL` |

## `token_holdings` (sin cambios de esquema)

Sigue siendo la fuente del saldo actual. Se usa para (a) el valor "antes" de cada movimiento (el `quantity` de la
instancia previa) y (b) el cierre de la validación cruzada del backfill.

## Tipos de dominio

### `TokenTransaction` (`domain/orders/token-transaction.ts`)

Agrega `balanceBefore: number | null` y `balanceAfter: number | null` (nulos sólo en filas legacy hasta el paso 2),
`orderId: string | null`, `counterpartOrderId: string | null` y `isEmission: boolean` (`orderId === null`).
`create` los acepta como opcionales (ningún llamador existente cambia); en el paso 2 pasan a requeridos.

### Snapshot de movimiento (`domain/portfolio/token-holding.ts`)

```text
MovementSnapshot  { before: number; after: number }
TokenHolding.applyCredit(q) → { holding: TokenHolding; snapshot: MovementSnapshot }
TokenHolding.applyDebit(q)  → { holding: TokenHolding; snapshot: MovementSnapshot }   // lanza InsufficientHoldingError si after < 0
credit(q) / debit(q)        → applyX(q).holding                                         // firmas existentes, sin cambios
```

### `settleFillsAudited` (`domain/orders/settle-fills.ts`)

```text
settleFillsAudited(fills, holdings) → {
  holdings: Map<userId, TokenHolding>,                 // igual que settleFills
  snapshots: Array<{ buyer: MovementSnapshot; seller: MovementSnapshot }>   // uno por fill, en el orden de fills
}
```

En un auto-cruce (mismo usuario comprador y vendedor) el `seller.before` de un fill es el `buyer.after` de ese mismo fill.

### Emisión (`domain/orders/token-emission.ts`)

```text
INITIAL_EMISSION_QUANTITY = 100
issueInitialEmission({ userId, playerId, price, createdAt, newId }) → { holding, entry }
  holding.quantity = 100
  entry: CREDIT, quantity 100, price, orderId = null, counterpartOrderId = null, balanceBefore 0, balanceAfter 100
```

### Cadena y reconstrucción (`domain/orders/balance-chain.ts`)

```text
orderForChain(entries)  → ordena por createdAt ↑, CREDIT antes que DEBIT, id ↑
chainBalances(opening, movements) → Array<{ before, after }>      // lanza si algún saldo < 0
reconstructHoldingChain({ pending, closingBalance, isSuperuser }) →
    { status: 'ok', opening, snapshots }
  | { status: 'inconsistent', reason: 'opening-mismatch' | 'negative-balance', opening, net, closingBalance }
```

`opening = closingBalance − net` es válido si es `0` o (`isSuperuser` y `= INITIAL_EMISSION_QUANTITY`).

## Reglas de lectura (sin cambio de contrato)

| Consulta | Antes | Ahora |
|----------|-------|-------|
| `findByUserId` (historial, chequeo de siembra) | todos los asientos del usuario | sólo `order_id IS NOT NULL` |
| `findCreditsByUserId` (costo promedio) | todos los CREDIT | sólo `order_id IS NOT NULL` |

## Estados del backfill (por tenencia)

```text
sin pendientes ──────────────────────────────▶ completa (no se toca)
con pendientes ─ validación ok ─ UPDATE ─────▶ aplicada
               └ validación falla ───────────▶ inconsistente (no se toca; se reporta)
```
