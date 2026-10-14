# Data Model: Historial de Cotizaciones del Jugador

Esta feature no agrega entidades de dominio ni columnas nuevas. Extiende únicamente el **puerto de repositorio** de `PlayerQuote` (dominio ya definido en 012-valuation-strategies, extendido en 014-position-weight-profiles) con un método de lectura adicional, y agrega un método de orquestación en `QuotationService`.

## Entidad de dominio reutilizada

### PlayerQuote *(sin cambios — ver 012-valuation-strategies/data-model.md y 014-position-weight-profiles/data-model.md)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Identificador único |
| `playerId` | `string` (UUID) | Referencia al jugador |
| `strategyId` | `string` (UUID) | Referencia a la estrategia usada en ese cálculo |
| `weightSnapshot` | `Record<string, number>` | Copia de los pesos usados (perfil de posición o generales) |
| `factorEscalaSnapshot` | `number` | Copia del factor de escala al momento del cálculo |
| `score` | `number` | Score calculado |
| `value` | `number` | Valor final del token |
| `calculatedAt` | `Date` | Timestamp del cálculo |
| `appliedPosition` | `Position \| null` | Posición cuyo perfil se usó, o `null` si se usaron los pesos generales |

## Puerto de repositorio — método nuevo

### `PlayerQuoteRepository.findAllByPlayerId`

```typescript
export interface PlayerQuoteRepository {
  saveMany(quotes: PlayerQuote[]): Promise<void>;
  findLatestByPlayerId(playerId: string): Promise<PlayerQuote | null>;
  findLatestAtDate(playerId: string, date: Date): Promise<PlayerQuote | null>;
  findAllByPlayerId(playerId: string): Promise<PlayerQuote[]>;   // ← nuevo
}
```

**Contrato**:
- Retorna **todas** las `PlayerQuote` de `playerId`, sin límite ni paginación.
- Orden: ascendente por `calculatedAt` (de la más antigua a la más reciente) — spec FR-002.
- Si el jugador no tiene ninguna cotización, retorna `[]` (no `null`, no excepción) — la distinción con "jugador inexistente" la resuelve el Service, no el Repository (ver más abajo).

**Implementación (`TypeOrmPlayerQuoteRepository`)**:
```sql
SELECT * FROM player_quotes
WHERE player_id = :playerId
ORDER BY calculated_at ASC;
```
Reutiliza el índice `(player_id, calculated_at DESC)` ya existente (research.md Decisión 5) — sin migration nueva.

## Service — método nuevo

### `QuotationService.getQuoteHistory`

```typescript
async getQuoteHistory(playerId: string): Promise<PlayerQuote[]> {
  const player = await this.playerRepository.findById(playerId);
  if (!player) {
    throw new PlayerNotFoundError();
  }
  return this.quoteRepository.findAllByPlayerId(playerId);
}
```

Mismo patrón de validación que `getQuoteAtDate` (research.md Decisión 6): valida existencia del jugador primero (404 vía `PlayerNotFoundError` → `AllExceptionsFilter`), y solo entonces consulta las cotizaciones. Si el jugador existe pero no tiene cotizaciones, `findAllByPlayerId` ya retorna `[]`, que se propaga tal cual (200 con array vacío — spec FR-005).

## Contrato de respuesta (Controller)

`GET /players/:id/quotes` → `PlayerQuoteResponseDto[]` (DTO ya existente, reutilizado sin cambios — research.md Decisión 2):

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Id de la `PlayerQuote` |
| `playerId` | `string` | Id del jugador |
| `strategyId` | `string` | Id de la estrategia usada en ese cálculo puntual |
| `score` | `number` | Score calculado |
| `value` | `number` | Valor del token |
| `calculatedAt` | `string` (ISO 8601) | Timestamp del cálculo |
| `appliedPosition` | `string \| null` | Posición del perfil aplicado, o `null` si fueron los pesos generales |

## Relaciones

Sin cambios respecto a 012-valuation-strategies / 014-position-weight-profiles:

```
players (1) ──< player_quotes (N)
valuation_strategies (1) ──< player_quotes (N)
```

Esta feature solo agrega una forma nueva de **leer** el lado "N" de `players (1) ──< player_quotes (N)` para un jugador puntual: todas sus filas, en vez de solo la más reciente o la vigente a una fecha.
