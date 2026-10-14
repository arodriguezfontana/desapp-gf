# Data Model: Perfiles de Pesos por Posición

## Entidades de dominio (extensiones)

### ValuationStrategy *(extiende la entidad de 012-valuation-strategies)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Sin cambios |
| `name` | `string` | Sin cambios |
| `weights` | `Record<string, number>` | Sin cambios — pesos generales |
| `factorEscala` | `number` | Sin cambios |
| `isActive` | `boolean` | Sin cambios |
| **`positionWeights`** *(nuevo)* | `Partial<Record<Position, Record<string, number>>>` | Mapa posición → (mapa métrica→peso). Puede estar vacío (`{}`) si la estrategia no define ningún perfil. Puede incluir de 1 a 4 posiciones. |

**Invariantes de dominio (nuevos)**:
- Para cada posición `p` presente en `positionWeights`: `Σ positionWeights[p][i] ∈ [0.999, 1.001]`.
- Para cada posición `p` presente en `positionWeights`: todas las claves de `positionWeights[p]` deben ser métricas válidas (mismo conjunto que `NORMALIZATION_BOUNDS`).
- `positionWeights` admite a lo sumo una entrada por posición (garantizado por el tipo `Partial<Record<Position, ...>>`, no por validación runtime adicional).
- Los pesos de un perfil pueden ser negativos (mismo criterio que los pesos generales, DD-003 de 012).

**Métodos de dominio (cambios)**:
- `static create(props)` — ahora valida también cada perfil de `positionWeights` presente, reutilizando el mismo helper de tolerancia de suma (`validateWeightsSum`) que ya usa para `weights`. Lanza `InvalidStrategyWeightsError` si algún perfil no cumple suma=1.0±0.001 o referencia una métrica inválida.
- `static restore(props)` — sin revalidar, igual que hoy.
- `get positionWeights()` *(nuevo getter)* — retorna copia defensiva del mapa.

---

### PlayerQuote *(extiende la entidad de 012-valuation-strategies)*

| Campo | Tipo dominio | Descripción |
|---|---|---|
| `id` | `string` (UUID) | Sin cambios |
| `playerId` | `string` (UUID) | Sin cambios |
| `strategyId` | `string` (UUID) | Sin cambios |
| `weightSnapshot` | `Record<string, number>` | Sin cambios de tipo — ahora puede contener el perfil de posición en lugar de los pesos generales, según `appliedPosition` |
| `factorEscalaSnapshot` | `number` | Sin cambios |
| `score` | `number` | Sin cambios |
| `value` | `number` | Sin cambios |
| `calculatedAt` | `Date` | Sin cambios |
| **`appliedPosition`** *(nuevo)* | `Position \| null` | `null` → se usaron los pesos generales de la estrategia. `Position` (`FW`/`MF`/`DF`/`GK`) → se usó el perfil de esa posición. |

---

## Función de cálculo pura (dominio) — cambios

Archivo: `backend/src/domain/quotation/calculate-player-value.ts`

```typescript
export function calculatePlayerValue(
  player: Player,
  strategy: ValuationStrategy,
): { score: number; value: number; appliedPosition: Position | null; weightsUsed: Record<string, number> } {
  const profile = strategy.positionWeights[player.position];
  const weightsUsed = profile ?? strategy.weights;
  const appliedPosition = profile ? player.position : null;

  let score = 0;
  for (const [metricKey, weight] of Object.entries(weightsUsed)) {
    const bound = NORMALIZATION_BOUNDS[metricKey];
    if (bound === undefined) continue;
    const raw = getMetric(player, metricKey) ?? 0;
    const clamped = Math.max(0, Math.min(raw, bound));
    score += weight * (clamped / bound);
  }

  const value = 1 + score * strategy.factorEscala;
  return { score, value, appliedPosition, weightsUsed };
}
```

Sin cambios en `NORMALIZATION_BOUNDS` ni en `getMetric`. Sigue siendo lógica de dominio pura: sin NestJS ni acceso a base de datos (Principio I, spec FR-008 de 012 heredado).

---

## Entidades de persistencia (TypeORM) — cambios

### `valuation_strategies` table (columna nueva)

| Columna | Tipo SQL | TypeORM | Notas |
|---|---|---|---|
| `position_weights` | `jsonb NULL` | `@Column({ name: 'position_weights', type: 'jsonb', nullable: true })` | `Record<string, Record<string, number>> \| null`. `null`/ausente ⇒ tratado como `{}` en el dominio (ningún perfil definido). |

### `player_quotes` table (columna nueva)

| Columna | Tipo SQL | TypeORM | Notas |
|---|---|---|---|
| `applied_position` | `varchar(2) NULL` | `@Column({ name: 'applied_position', type: 'varchar', length: 2, nullable: true })` | Valores posibles: `'FW'`, `'MF'`, `'DF'`, `'GK'`, o `NULL` (pesos generales). |

**Mapeo (`ValuationStrategyMapper`)**:
- `toDomain`: `positionWeights: entity.positionWeights ?? {}`
- `toPersistence`: `positionWeights: Object.keys(domain.positionWeights).length > 0 ? domain.positionWeights : null`

**Mapeo (`PlayerQuoteMapper`)**:
- `toDomain`: `appliedPosition: (entity.appliedPosition as Position | null) ?? null`
- `toPersistence`: `appliedPosition: domain.appliedPosition`

Sin cambios en los demás campos ni en los índices ya definidos en 012-valuation-strategies.

---

## Migraciones

1. **`<timestamp>-AddPositionWeightsColumns.ts`** (schema):
   ```sql
   ALTER TABLE "valuation_strategies" ADD COLUMN "position_weights" jsonb NULL;
   ALTER TABLE "player_quotes" ADD COLUMN "applied_position" varchar(2) NULL;
   ```
   `down()`: `DROP COLUMN` de ambas, en orden inverso.

2. **`<timestamp+1d>-SeedPositionWeightProfiles.ts`** (data, idempotente vía `UPDATE ... WHERE id IN (...)`):
   ```sql
   UPDATE "valuation_strategies" SET "position_weights" = '{
     "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.15},
     "MF": {"assists":0.30,"keyPasses":0.30,"dribbles":0.15,"rating":0.25},
     "DF": {"totalTackles":0.40,"interceptions":0.25,"rating":0.25,"passesCompleted":0.10},
     "GK": {"rating":0.50,"passesCompleted":0.30,"interceptions":0.20}
   }' WHERE "id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

   UPDATE "valuation_strategies" SET "position_weights" = '{
     "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.20,"yellowCards":-0.05},
     "MF": {"assists":0.25,"keyPasses":0.25,"passesCompleted":0.20,"rating":0.20,"totalTackles":0.10},
     "DF": {"totalTackles":0.40,"interceptions":0.35,"rating":0.25},
     "GK": {"rating":0.50,"passesCompleted":0.35,"interceptions":0.15}
   }' WHERE "id" = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
   ```
   `down()`: `UPDATE ... SET "position_weights" = NULL WHERE "id" IN (...)`.

Verificación de sumas (todas ±0.001 de 1.0):

| Estrategia | Posición | Suma |
|---|---|---|
| Performance general | FW | 0.45+0.25+0.15+0.15 = 1.00 |
| Performance general | MF | 0.30+0.30+0.15+0.25 = 1.00 |
| Performance general | DF | 0.40+0.25+0.25+0.10 = 1.00 |
| Performance general | GK | 0.50+0.30+0.20 = 1.00 |
| Impacto táctico | FW | 0.45+0.25+0.15+0.20−0.05 = 1.00 |
| Impacto táctico | MF | 0.25+0.25+0.20+0.20+0.10 = 1.00 |
| Impacto táctico | DF | 0.40+0.35+0.25 = 1.00 |
| Impacto táctico | GK | 0.50+0.35+0.15 = 1.00 |

---

## Relaciones

Sin cambios respecto a 012-valuation-strategies:

```
players (1) ──< player_quotes (N)
valuation_strategies (1) ──< player_quotes (N)
```

`positionWeights` y `appliedPosition` son atributos adicionales de entidades ya relacionadas; no se agregan tablas ni relaciones nuevas.
