# Data Model: Alertas de precio por estrategia personal

## PriceAlert

Representa la intención de un usuario de ser avisado cuando su cotización personal de
un jugador cumpla una condición.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | FK lógica a usuario propietario; owner-only para consulta/cancelación (FR-005, FR-006, FR-007) |
| `playerId` | UUID | FK lógica a jugador; debe existir al crear (FR-002) |
| `condition` | enum `AlertCondition` (`PRICE_ABOVE` \| `PRICE_BELOW`) | "sube de" / "baja de" (FR-001, FR-002) |
| `targetValue` | `DECIMAL(10,2)` | Umbral; MUST ser positivo (FR-002). Misma escala que valor/precio de token según convención de la constitución |
| `status` | enum `AlertStatus` (`ACTIVE` \| `CANCELLED`) | Creada siempre en `ACTIVE` (FR-004); pasa a `CANCELLED` solo por acción explícita del usuario (FR-006, FR-008) |
| `createdAt` | timestamp | Auditoría/orden de listado |
| `cancelledAt` | timestamp nullable | Se completa al cancelar |

**Invariantes de dominio** (en la clase `PriceAlert`, no en Service/Repository):

- `targetValue` MUST ser > 0 al construirse; de lo contrario lanza
  `InvalidAlertThresholdError`.
- `condition` MUST ser uno de los dos valores del enum `AlertCondition`; cualquier otro
  valor lanza `InvalidAlertConditionError`.
- `matches(newValue: number): boolean` — único punto donde vive la lógica de "cumple la
  condición": `newValue < targetValue` para `PRICE_BELOW`, `newValue > targetValue` para
  `PRICE_ABOVE`. Solo evalúa si `status === ACTIVE`.
- `cancel()` — transición `ACTIVE → CANCELLED`; no-op idempotente si ya está cancelada
  (cancelar dos veces no es un error, pero no hay caso de uso que lo dispare desde el
  controller: el Service ya filtra por alertas propias existentes).
- No hay restricción de unicidad: múltiples `PriceAlert` activas del mismo usuario sobre
  el mismo jugador son válidas (spec FR-003).

**Relaciones**: `userId` y `playerId` son referencias lógicas a entidades de otros
módulos (`User`, `Player`) ya existentes; no se agregan FKs nuevas a esos módulos, solo
se valida su existencia en el Service al crear.

## Notification

Representa un aviso generado por el disparo de una `PriceAlert` puntual.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | Destinatario; owner-only para listado/lectura |
| `alertId` | UUID | FK lógica a la `PriceAlert` que disparó esta notificación |
| `playerId` | UUID | Denormalizado desde la alerta para evitar join al listar (FR-013) |
| `condition` | enum `AlertCondition` | Condición cumplida, copiada de la alerta al momento del disparo (histórico: si la alerta cambiara no debe afectar notificaciones pasadas — aunque hoy no hay edición de alertas, se denormaliza por robustez) |
| `triggeredValue` | `DECIMAL(10,2)` | Valor de la `PlayerQuote` que cumplió la condición (FR-013) |
| `createdAt` | timestamp | Fecha del disparo (FR-013); también usado para orden "más recientes primero" (FR-014) |
| `read` | boolean | `false` al crearse; `true` al marcarse como leída (FR-016) |

**Invariantes de dominio**:

- Se crea siempre con `read = false`.
- `markAsRead()` — transición `false → true`, idempotente.
- No hay transición inversa (no existe "marcar como no leída" en el alcance de la spec).

**Relaciones**: Una `Notification` referencia exactamente una `PriceAlert` (vía
`alertId`) y un `userId`. Una `PriceAlert` puede generar múltiples `Notification` a lo
largo del tiempo (una por cada disparo, FR-009).

## Domain Events (internos, no persistidos como entidad propia)

### `QuoteRecalculatedEvent` (`quote.recalculated`)

| Campo | Tipo |
|---|---|
| `userId` | UUID |
| `playerId` | UUID |
| `value` | number (valor nuevo de la `PlayerQuote`) |
| `occurredAt` | Date |

Emitido por `QuotationService.recalculateAll()` una vez por cada `PlayerQuote` nueva
persistida (no por cada combinación salteada en `skipped`).

### `AlertTriggeredEvent` (`alert.triggered`)

| Campo | Tipo |
|---|---|
| `alertId` | UUID |
| `userId` | UUID |
| `playerId` | UUID |
| `condition` | `AlertCondition` |
| `triggeredValue` | number |
| `occurredAt` | Date |

Emitido por el listener de alertas (`QuoteRecalculatedListener`, en el módulo
`alerts`) cuando `PriceAlert.matches(value)` es `true` para alguna alerta activa del
usuario+jugador del evento recibido. Un `QuoteRecalculatedEvent` puede producir cero,
uno o varios `AlertTriggeredEvent` (una por cada alerta activa que cumple la condición,
edge case de múltiples alertas sobre el mismo jugador).

## State Transitions

```text
PriceAlert:   ACTIVE --(cancel, por el usuario)--> CANCELLED   [terminal]
              ACTIVE --(matches == true, en cada recálculo)--> ACTIVE (sigue activa, puede volver a dispararse)

Notification: unread --(markAsRead)--> read   [terminal, sin vuelta a unread]
```

## Validation Summary (cross-reference con Requirements)

| Regla | Nivel | Requirement |
|---|---|---|
| Jugador existe | Service (consulta a `PlayerRepository`) | FR-002 |
| Umbral > 0 y numérico | DTO (class-validator `@IsNumber`, `@IsPositive`) + Dominio (invariante del constructor) | FR-002 |
| Condición ∈ {sube, baja} | DTO (`@IsEnum(AlertCondition)`) + Dominio | FR-002 |
| Alerta pertenece al usuario autenticado | Service (compara `alert.userId` vs usuario del JWT) | FR-005, FR-006, FR-007 |
| Notificación pertenece al usuario autenticado | Service | FR-005 (análogo) |
