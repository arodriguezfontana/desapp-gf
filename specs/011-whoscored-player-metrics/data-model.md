# Data Model: Extensión de Métricas de Jugador (WhoScored)

## Entidades y Atributos

### 1. Modelo de Dominio: `Player`

Clase inmutable de dominio que representa a un futbolista en el catálogo.

| Campo | Tipo | Nulleable | Descripción |
|---|---|---|---|
| `id` | `string` (UUID) | No | Identificador único interno |
| `name` | `string` | No | Nombre del jugador |
| `league` | `League` (Enum) | No | Liga a la que pertenece |
| `team` | `string` | No | Nombre de equipo (WhoScored) |
| `position` | `Position` (Enum) | No | Posición deportiva normalizada (GK, DF, MF, FW) |
| `passesCompleted` | `number \| null` | Sí | Promedio de pases completados por partido |
| `shots` | `number \| null` | Sí | Promedio de remates por partido |
| `interceptions` | `number \| null` | Sí | Promedio de intercepciones por partido |
| `rating` | `number \| null` | Sí | Calificación promedio WhoScored |
| **`goals`** *(nuevo)* | `number \| null` | Sí | Goles totales en la temporada |
| **`assists`** *(nuevo)* | `number \| null` | Sí | Asistencias totales en la temporada |
| **`keyPasses`** *(nuevo)* | `number \| null` | Sí | Pases clave totales en la temporada |
| **`dribbles`** *(nuevo)* | `number \| null` | Sí | Regates exitosos totales en la temporada |
| **`totalTackles`** *(nuevo)* | `number \| null` | Sí | Entradas / quites totales en la temporada |
| **`yellowCards`** *(nuevo)* | `number \| null` | Sí | Tarjetas amarillas acumuladas en la temporada |
| **`redCards`** *(nuevo)* | `number \| null` | Sí | Tarjetas rojas acumuladas en la temporada |

### 2. Entidad de Persistencia: `PlayerEntity` (Tabla `players`)

Mapeo TypeORM sobre la tabla relacional PostgreSQL.

```sql
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "goals" integer NULL,
  ADD COLUMN IF NOT EXISTS "assists" integer NULL,
  ADD COLUMN IF NOT EXISTS "keyPasses" integer NULL,
  ADD COLUMN IF NOT EXISTS "dribbles" integer NULL,
  ADD COLUMN IF NOT EXISTS "totalTackles" integer NULL,
  ADD COLUMN IF NOT EXISTS "yellowCards" integer NULL,
  ADD COLUMN IF NOT EXISTS "redCards" integer NULL;
```

Columnas actualizadas en TypeORM:
- `goals`: `@Column({ type: 'integer', nullable: true })`
- `assists`: `@Column({ type: 'integer', nullable: true })`
- `keyPasses`: `@Column({ type: 'integer', nullable: true })`
- `dribbles`: `@Column({ type: 'integer', nullable: true })`
- `totalTackles`: `@Column({ type: 'integer', nullable: true })`
- `yellowCards`: `@Column({ type: 'integer', nullable: true })`
- `redCards`: `@Column({ type: 'integer', nullable: true })`

### 3. Interfaces de Integración / Sync

#### `WhoScoredRawMetrics` (Puerto Adapter)
```typescript
export interface WhoScoredRawMetrics {
  passesCompleted: number;
  shots: number;
  interceptions: number;
  rating: number;
  goals: number | null;
  assists: number | null;
  keyPasses: number | null;
  dribbles: number | null;
  totalTackles: number | null;
  yellowCards: number | null;
  redCards: number | null;
}
```

#### `PlayerMetrics` (Dominio de Sync)
```typescript
export interface PlayerMetrics {
  passesCompleted: number;
  shots: number;
  interceptions: number;
  rating: number;
  goals: number | null;
  assists: number | null;
  keyPasses: number | null;
  dribbles: number | null;
  totalTackles: number | null;
  yellowCards: number | null;
  redCards: number | null;
}
```

### 4. DTO de Transferencia de Datos: `PlayerResponseDto`

Propiedades expuestas en la API REST:

```typescript
export class PlayerResponseDto {
  id: string;
  name: string;
  league: string;
  team: string;
  position: string;
  passesCompleted: number | null;
  shots: number | null;
  interceptions: number | null;
  rating: number | null;
  crestUrl: string | null;
  goals: number | null;
  assists: number | null;
  keyPasses: number | null;
  dribbles: number | null;
  totalTackles: number | null;
  yellowCards: number | null;
  redCards: number | null;
}
```

