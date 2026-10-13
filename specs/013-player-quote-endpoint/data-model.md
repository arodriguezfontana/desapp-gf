# Data Model: Consulta de Cotización de Jugador (GET /players/:id/quote)

Esta feature reutiliza las entidades existentes de la base de datos sin requerir nuevas tablas ni migraciones de esquema:
- `player`: almacena la información de los futbolistas (catálogo).
- `player_quotes`: almacena los snapshots históricos de cotizaciones de cada jugador.
- `valuation_strategies`: almacena las estrategias de valuación configuradas.

## Entidades y Atributos Relevantes

### 1. PlayerQuote (Dominio & Persistencia)

- **Tabla**: `player_quotes`
- **Campos**:
  | Campo | Tipo DB | Tipo TS | Descripción |
  |---|---|---|---|
  | `id` | UUID (PK) | `string` | Identificador único de la cotización |
  | `player_id` | UUID (FK `players.id`) | `string` | Identificador del jugador cotizado |
  | `strategy_id` | UUID (FK `valuation_strategies.id`) | `string` | Estrategia utilizada en el cálculo |
  | `weight_snapshot` | JSONB | `Record<string, number>` | Snapshot de los pesos por métrica al momento del cálculo |
  | `factor_escala_snapshot` | DECIMAL(10,4) | `number` | Snapshot del factor de escala al momento del cálculo |
  | `score` | DECIMAL(8,6) | `number` | Score normalizado resultante del cálculo |
  | `value` | DECIMAL(10,2) | `number` | Valor del token en créditos (`1 + score × factorEscala`) |
  | `calculated_at` | TIMESTAMPTZ | `Date` | Timestamp exacto en que se calculó la cotización |

- **Índices y Ordenamiento**:
  - Consulta: `WHERE player_id = :playerId AND calculated_at <= :date ORDER BY calculated_at DESC LIMIT 1`
  - Permite recuperar la cotización vigente al cierre de una fecha dada de forma determinista.

---

### 2. ValuationStrategy (Dominio & Persistencia)

- **Tabla**: `valuation_strategies`
- **Campos**:
  | Campo | Tipo DB | Tipo TS | Descripción |
  |---|---|---|---|
  | `id` | UUID (PK) | `string` | Identificador único de la estrategia |
  | `name` | VARCHAR | `string` | Nombre descriptivo de la estrategia (resuelto para `strategyName`) |
  | `weights` | JSONB | `Record<string, number>` | Pesos configurados por métrica |
  | `factor_escala` | DECIMAL(10,4) | `number` | Factor de escala multiplicador |
  | `is_active` | BOOLEAN | `boolean` | Indica si es la estrategia activa del sistema |

---

### 3. Player (Dominio & Persistencia)

- **Tabla**: `players`
- **Campos relevantes**:
  | Campo | Tipo DB | Tipo TS | Descripción |
  |---|---|---|---|
  | `id` | UUID (PK) | `string` | Identificador único del jugador |
  | `name` | VARCHAR | `string` | Nombre del futbolista |
  | `removed_at` | TIMESTAMPTZ | `Date \| null` | Fecha de baja lógica (jugadores vigentes tienen `NULL`) |

- **Regla**: Si `playerRepository.findById(id)` retorna `null` (no existe o `removed_at IS NOT NULL`), se lanza `PlayerNotFoundError` y se responde HTTP 404.

---

## Modelos en Memoria y Tipos de Transferencia

### PlayerQuoteWithStrategy (Objeto de dominio / Servicio)

Estructura devuelta por el servicio `QuotationService.getQuoteAtDate(playerId, date)`:
```typescript
export interface PlayerQuoteWithStrategy {
  quote: PlayerQuote;
  strategyName: string;
}
```

### PlayerQuoteResponseDto (Capa HTTP / Controller)

Estructura devuelta en HTTP 200:
```typescript
{
  playerId: string;       // UUID del jugador
  valor: number;          // DECIMAL(10,2) - Valor del token en créditos
  score: number;          // DECIMAL(8,6) - Score normalizado
  strategyName: string;   // Nombre de la estrategia con la que se calculó
  weights: Record<string, number>; // Snapshot de los pesos aplicados
  calculatedAt: string;   // Timestamp ISO 8601 (UTC)
}
```

