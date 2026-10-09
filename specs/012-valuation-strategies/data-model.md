# Data Model: Estrategias de Valuación de Jugadores

## Entidades de dominio

### ValuationStrategy

Clase de dominio que encapsula una estrategia de valuación. Contiene el conjunto de pesos por métrica y el factor de escala que determinan cómo se calcula el valor de un jugador.

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Identificador único |
| `name` | `string` | Nombre descriptivo de la estrategia |
| `weights` | `Record<string, number>` | Mapa métrica→peso. Pesos decimales; suma algebraica debe ser 1.0 ± 0.001 |
| `factorEscala` | `number` | Factor de escala, decimal positivo |
| `isActive` | `boolean` | Indica si la estrategia es la actualmente activa |

**Invariantes de dominio**:
- `Σ weights[i] ∈ [0.999, 1.001]` (suma con tolerancia por redondeo flotante)
- `factorEscala > 0`
- En cualquier momento, como máximo una `ValuationStrategy` tiene `isActive = true`

**Métodos de dominio**:
- `static create(props)` — factory que valida invariantes; lanza `InvalidStrategyWeightsError` si suma ∉ [0.999, 1.001] o `factorEscala ≤ 0`
- `static restore(props)` — rehydration desde persistencia sin revalidar
- `activate()` — retorna una nueva instancia con `isActive = true`
- `deactivate()` — retorna una nueva instancia con `isActive = false`

---

### PlayerQuote

Cotización calculada de un jugador en un momento dado. Registra el snapshot completo de los parámetros de cálculo para garantizar reproducibilidad histórica.

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Identificador único |
| `playerId` | `string` (UUID) | Referencia al jugador |
| `strategyId` | `string` (UUID) | Referencia a la estrategia usada |
| `weightSnapshot` | `Record<string, number>` | Copia de `weights` al momento del cálculo |
| `factorEscalaSnapshot` | `number` | Copia de `factorEscala` al momento del cálculo |
| `score` | `number` | Score calculado: Σ(peso_i × métrica_i_normalizada) |
| `value` | `number` | Valor final: 1 + (score × factorEscalaSnapshot) |
| `calculatedAt` | `Date` | Timestamp del cálculo |

**Nota**: `value` puede ser negativo si el score es suficientemente negativo (métricas disciplinarias con pesos negativos altos). Se persiste sin clamp — riesgo aceptado.

---

### NormalizationBounds (constantes del sistema, no entidad persistida)

Valores máximos de referencia para normalizar métricas al rango [0,1]. Definidos como constante exportada en el módulo de dominio de cálculo.

| Métrica (nombre de campo Player) | Bound |
|---|---|
| `goals` | 40 |
| `assists` | 25 |
| `keyPasses` | 150 |
| `dribbles` | 200 |
| `totalTackles` | 150 |
| `shots` | 200 |
| `passesCompleted` | 2500 |
| `interceptions` | 100 |
| `rating` | 10 |
| `yellowCards` | 15 |
| `redCards` | 5 |

**Criterio de definición**: Máximos realistas que un jugador de élite puede alcanzar en una temporada completa de liga. Por ejemplo: 40 goles (récord histórico excepcional), 25 asistencias (ídem), 10 de rating (máximo de la escala WhoScored). Son constantes inmutables del sistema; cambiarlas alteraría retroactivamente el significado de todos los scores ya calculados.

---

## Entidades de persistencia (TypeORM)

### `valuation_strategies` table

| Columna | Tipo SQL | TypeORM | Notas |
|---|---|---|---|
| `id` | `uuid` | `@PrimaryGeneratedColumn('uuid')` | |
| `name` | `varchar(120)` | `@Column({ length: 120 })` | |
| `weights` | `jsonb` | `@Column({ type: 'jsonb' })` | `Record<string, number>` |
| `factor_escala` | `DECIMAL(10,4)` | `@Column({ type: 'decimal', precision: 10, scale: 4 })` | |
| `is_active` | `boolean` | `@Column({ default: false })` | Solo una fila puede ser `true` |
| `created_at` | `timestamptz` | `@CreateDateColumn()` | |

**Índice**: `WHERE is_active = true` para búsqueda eficiente de la estrategia activa.

### `player_quotes` table

| Columna | Tipo SQL | TypeORM | Notas |
|---|---|---|---|
| `id` | `uuid` | `@PrimaryGeneratedColumn('uuid')` | |
| `player_id` | `uuid` | `@Column('uuid')` | FK a `players.id` |
| `strategy_id` | `uuid` | `@Column('uuid')` | FK a `valuation_strategies.id` |
| `weight_snapshot` | `jsonb` | `@Column({ type: 'jsonb' })` | Snapshot de pesos al momento del cálculo |
| `factor_escala_snapshot` | `DECIMAL(10,4)` | `@Column({ type: 'decimal', precision: 10, scale: 4 })` | |
| `score` | `DECIMAL(8,6)` | `@Column({ type: 'decimal', precision: 8, scale: 6 })` | Puede ser negativo |
| `value` | `DECIMAL(10,2)` | `@Column({ type: 'decimal', precision: 10, scale: 2 })` | Puede ser negativo; sin clamp |
| `calculated_at` | `timestamptz` | `@CreateDateColumn()` | |

**Índice**: `(player_id, calculated_at DESC)` para consultas de cotización más reciente por jugador.

---

## Relaciones

```
players (1) ──< player_quotes (N)
valuation_strategies (1) ──< player_quotes (N)
```

La relación `player_quotes.strategy_id → valuation_strategies.id` es una FK sin cascade. Si en el futuro se eliminara una estrategia, las cotizaciones históricas conservarían su `weight_snapshot` y `factor_escala_snapshot` para reproducibilidad.

---

## Función de cálculo pura (dominio)

Archivo: `backend/src/domain/quotation/calculate-player-value.ts`

```typescript
// Constante exportada para uso en tests
export const NORMALIZATION_BOUNDS: Record<string, number> = {
  goals: 40, assists: 25, keyPasses: 150, dribbles: 200,
  totalTackles: 150, shots: 200, passesCompleted: 2500,
  interceptions: 100, rating: 10, yellowCards: 15, redCards: 5,
};

export function calculatePlayerValue(
  player: Player,
  strategy: ValuationStrategy,
): { score: number; value: number } {
  // Para cada métrica en los pesos de la estrategia:
  //   normalizada = clamp(metrica ?? 0, 0, bound) / bound
  //   score += peso * normalizada
  // value = 1 + (score * strategy.factorEscala)
}
```

Sin imports de NestJS, TypeORM ni acceso a base de datos. Solo recibe objetos de dominio y devuelve el resultado.

---

## Seed data

**Migration**: `YYYYMMDDHHMMSS-SeedValuationStrategies.ts`

**Estrategia 1 — "Performance general"** (activa por defecto):
```json
{
  "name": "Performance general",
  "weights": {
    "goals": 0.25, "assists": 0.15, "shots": 0.10,
    "keyPasses": 0.10, "dribbles": 0.10, "totalTackles": 0.10, "rating": 0.20
  },
  "factorEscala": 99,
  "isActive": true
}
```
Suma: 0.25+0.15+0.10+0.10+0.10+0.10+0.20 = 1.00 ✓ | Rango valor resultante: [1, 100]

**Estrategia 2 — "Impacto táctico"**:
```json
{
  "name": "Impacto táctico",
  "weights": {
    "totalTackles": 0.25, "interceptions": 0.20, "passesCompleted": 0.20,
    "assists": 0.20, "keyPasses": 0.15, "rating": 0.20,
    "yellowCards": -0.05, "redCards": -0.15
  },
  "factorEscala": 99,
  "isActive": false
}
```
Suma: (0.25+0.20+0.20+0.20+0.15+0.20) − (0.05+0.15) = 1.20 − 0.20 = 1.00 ✓
