# Data Model: Estrategias de Valuación Propias por Usuario

## Entidades de dominio

### ValuationStrategy *(redefine su alcance, ver 012-valuation-strategies y 014-position-weight-profiles)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Sin cambios |
| `userId` *(nuevo)* | `string` (UUID) | Dueño exclusivo de la estrategia. Reemplaza la noción de estrategia global. |
| `name` | `string` | Sin cambios — siempre `"Performance general"` o `"Impacto táctico"` para las dos fijas de cada usuario |
| `weights` | `Record<string, number>` | Sin cambios de tipo |
| `positionWeights` | `Partial<Record<Position, Record<string, number>>>` | Sin cambios de tipo (ver 014) |
| `factorEscala` | `number` | Sin cambios |
| **`isSelected`** *(renombra `isActive`)* | `boolean` | Reemplaza el flag global `isActive`. Invariante: exactamente una fila en `true` por `userId`, nunca una comparación entre usuarios distintos. |
| `createdAt` | `Date` | Sin cambios |

**Invariantes de dominio**:
- `Σ weights[i] ∈ [0.999, 1.001]` (sin cambios, ver 012).
- Para cada posición `p` en `positionWeights`: `Σ positionWeights[p][i] ∈ [0.999, 1.001]` (sin cambios, ver 014).
- **(nuevo)** Para un mismo `userId`, deben existir siempre exactamente dos filas de `ValuationStrategy`, nunca más ni menos; no hay operación de creación ni borrado expuesta más allá del provisioning automático al alta.
- **(nuevo)** Para un mismo `userId`, exactamente una de sus dos filas tiene `isSelected = true` en todo momento.

**Métodos de dominio (cambios respecto a 012/014)**:
- `static create(props)` — agrega `userId` a las props requeridas; sin cambios en la validación de suma de pesos (reutiliza `validateWeightsSum`).
- `static restore(props)` — idem, agrega `userId`; no revalida (igual que hoy).
- ~~`activate()` / `deactivate()`~~ → **reemplazados por** `select()` / `deselect()`: misma forma (devuelven una nueva instancia inmutable con el flag invertido), solo cambia el nombre para reflejar que ya no implica "para todo el sistema".
- `withWeights(weights)` *(nuevo)* — devuelve nueva instancia con pesos generales reemplazados, revalidando la suma; usado por `PATCH .../weights`.
- `withPositionWeights(position, weights)` *(nuevo)* — devuelve nueva instancia con el perfil de una posición reemplazado, revalidando la suma de ese perfil únicamente; usado por `PATCH .../position-weights/:position`.
- `assertOwnedBy(userId)` *(nuevo)* — lanza `StrategyOwnershipError` (403) si `this.userId !== userId`; se invoca al inicio de toda operación de selección/edición antes de aplicar el cambio.

---

### PlayerQuote *(extiende 012-valuation-strategies / 014-position-weight-profiles)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Sin cambios |
| **`userId`** *(nuevo)* | `string` (UUID) | Usuario que disparó el recálculo que generó esta cotización. Inmutable una vez creada. |
| `playerId` | `string` (UUID) | Sin cambios |
| `strategyId` | `string` (UUID) | Sin cambios — referencia a la `ValuationStrategy` (ahora propia de `userId`) usada en ese cálculo |
| `weightSnapshot` | `Record<string, number>` | Sin cambios de tipo |
| `factorEscalaSnapshot` | `number` | Sin cambios |
| `score` | `number` | Sin cambios |
| `value` | `number` | Sin cambios |
| `calculatedAt` | `Date` | Sin cambios |
| `appliedPosition` | `Position \| null` | Sin cambios |

**Invariantes de dominio**:
- Inmutable tras creación (sin cambios respecto a 012): no existe método de dominio que modifique un `PlayerQuote` ya persistido.
- **(nuevo)** El historial de un jugador para un usuario es la colección de `PlayerQuote` con `playerId` y `userId` dados, ordenada por `calculatedAt` ascendente; nunca se filtra ni se mezcla con `PlayerQuote` de otro `userId`.

---

## Esquema de persistencia (TypeORM)

### `valuation_strategies` (cambios sobre la entidad existente)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | Sin cambios |
| **`user_id`** *(nueva)* | `uuid NOT NULL` | `FOREIGN KEY → users(id) ON DELETE CASCADE`. Índice compuesto `(user_id, is_selected)` para resolver rápido "la seleccionada de este usuario". |
| `name` | `varchar(120)` | Sin cambios |
| `weights` | `jsonb` | Sin cambios |
| `position_weights` | `jsonb NULL` | Sin cambios |
| `factor_escala` | `decimal(10,4)` | Sin cambios |
| **`is_selected`** *(renombra `is_active`)* | `boolean NOT NULL DEFAULT false` | Reemplaza `is_active`; mismo tipo de columna, migración de rename + cambio semántico documentado |
| `created_at` | `timestamptz` | Sin cambios |

Constraint recomendado (aplicado a nivel de servicio/transacción, no de `CHECK` SQL, por
paridad con cómo ya se garantiza "exactamente una activa" hoy): índice único parcial
`UNIQUE (user_id) WHERE is_selected = true` para blindar a nivel de base de datos que
nunca haya dos seleccionadas simultáneas para el mismo usuario, incluso ante un bug de
aplicación.

### `player_quotes` (cambios sobre la entidad existente)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | Sin cambios |
| **`user_id`** *(nueva)* | `uuid NOT NULL` | `FOREIGN KEY → users(id) ON DELETE CASCADE`. Índice compuesto `(user_id, player_id, calculated_at)` para el listado cronológico del historial por usuario. |
| `player_id` | `uuid` | Sin cambios |
| `strategy_id` | `uuid` | Sin cambios |
| `weight_snapshot` | `jsonb` | Sin cambios |
| `factor_escala_snapshot` | `decimal(10,4)` | Sin cambios |
| `score` | `decimal(8,6)` | Sin cambios |
| `value` | `decimal(10,2)` | Sin cambios |
| `calculated_at` | `timestamptz` | Sin cambios |
| `applied_position` | `varchar(2) NULL` | Sin cambios |

### Migraciones de esquema (orden)

1. Eliminar las filas seed existentes de `valuation_strategies` (y las `player_quotes`
   que las referencian por `strategy_id`) — ver research.md D2.
2. Agregar `user_id uuid NOT NULL` a `valuation_strategies` con FK a `users(id)`.
3. Renombrar `is_active` → `is_selected` en `valuation_strategies` (sin cambio de tipo).
4. Crear índice único parcial `UNIQUE (user_id) WHERE is_selected = true`.
5. Agregar `user_id uuid NOT NULL` a `player_quotes` con FK a `users(id)`.
6. Crear índice compuesto `(user_id, player_id, calculated_at)` en `player_quotes`.

### Datos seed por usuario (valores exactos a copiar en el provisioning, ver 012/014)

- **"Performance general"**: `weights = {goals:0.25, assists:0.15, shots:0.10,
  keyPasses:0.10, dribbles:0.10, totalTackles:0.10, rating:0.20}`, `factorEscala = 99.0`.
- **"Impacto táctico"**: `weights = {totalTackles:0.25, interceptions:0.20,
  passesCompleted:0.20, assists:0.20, keyPasses:0.15, rating:0.20, yellowCards:-0.05,
  redCards:-0.15}`, `factorEscala = 99.0`.
- Perfiles de posición (`positionWeights`, FW/MF/DF/GK) de ambas estrategias: copiados
  literalmente de los valores ya sembrados por
  `1791763200000-SeedPositionWeightProfiles.ts` para cada una de las dos estrategias
  seed, sin modificar valores ni agregar/quitar posiciones.
- "Performance general" queda `isSelected = true` por defecto al crear el par (consistente
  con el `is_active = true` que ya tenía hoy la fila seed de sistema); "Impacto táctico"
  queda `isSelected = false`.

## State transitions

- `ValuationStrategy.isSelected`: `false → true` (vía `select()`, desmarca atómicamente
  la otra estrategia del mismo usuario) y `true → false` (como efecto colateral de que la
  otra fue seleccionada; nunca se invoca `deselect()` de forma aislada dejando las dos en
  `false`).
- `ValuationStrategy.weights` / `positionWeights[position]`: reemplazo completo del mapa
  (no merge parcial) tras pasar la validación de suma; si falla, el estado anterior
  persiste sin cambios (todo o nada, Principio VI).
- `PlayerQuote`: solo transición `(no existe) → creada`; no hay transición posterior.
