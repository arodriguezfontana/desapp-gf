# Data Model: Ranking de Jugadores por Cotización Vigente (GET /players/ranking)

**Feature**: `016-player-ranking-endpoint`  
**Date**: 2026-10-14  

---

## 1. Domain Entities & Interfaces

### 1.1 `RankedPlayerQuote` (Domain Item)
Representa la tupla de dominio obtenida desde la persistencia que asocia a un futbolista con su cotización más reciente.

```ts
export interface RankedPlayerQuote {
  player: Player;
  valor: number;
  score: number;
  strategyName: string;
  calculatedAt: Date;
}
```

### 1.2 `PlayerRankingPage` (Domain Page)
Página devuelta por `PlayerRepository.findRanking`.

```ts
export interface PlayerRankingPage {
  items: RankedPlayerQuote[];
  total: number;
}
```

### 1.3 `RankedPlayerWithCrest` (Service Enrichment)
Representación de dominio producida por `PlayerEnrichmentService` que adiciona el escudo del club (`crestUrl`) y la posición ordinal calculada (`rank`).

```ts
export interface RankedPlayerWithCrest {
  player: Player;
  crestUrl: string | null;
  rank: number;
  valor: number;
  score: number;
  strategyName: string;
  calculatedAt: Date;
}
```

### 1.4 `PlayerRankingPageWithCrests` (Service Page)
```ts
export interface PlayerRankingPageWithCrests {
  items: RankedPlayerWithCrest[];
  total: number;
}
```

---

## 2. DTOs (Data Transfer Objects)

### 2.1 Request: `PlayerRankingQueryDto` (o `RankingFiltersDto`)
Representa los parámetros de query permitidos en la solicitud `GET /players/ranking`.

| Campo | Tipo | Requerido | Validaciones | Descripción |
|---|---|---|---|---|
| `league` | `string` | No | `@IsOptional()`, enum `League` | Liga de competencia (ej. `La Liga`) |
| `position` | `string` | No | `@IsOptional()`, enum `Position` | Posición en cancha (`GK`, `DF`, `MF`, `FW`) |
| `team` | `string` | No | `@IsOptional()`, `@IsString()` | Nombre parcial o completo del equipo |
| `page` | `number` | No | `@IsOptional()`, `@Type(() => Number)`, `@Min(1)` | Número de página (default: 1) |
| `pageSize` | `number` | No | `@IsOptional()`, `@Type(() => Number)`, `@Min(1)`, `@Max(50)` | Tamaño de página (default: 10, max: 50) |

### 2.2 Response: `PlayerRankingResponseDto`
Representa un jugador individual clasificado dentro del ranking.

| Campo | Tipo | Nullable | Ejemplo | Descripción |
|---|---|---|---|---|
| `rank` | `number` | No | `1` | Posición ordinal en el ranking (1..N) |
| `id` | `string` (UUID) | No | `"b3f1c2a4-..."` | Identificador del jugador |
| `name` | `string` | No | `"Kylian Mbappé"` | Nombre del jugador |
| `league` | `string` | No | `"La Liga"` | Liga del jugador |
| `team` | `string` | No | `"Real Madrid"` | Club del jugador |
| `position` | `string` | No | `"FW"` | Posición en campo |
| `crestUrl` | `string` | Sí | `"https://crests.football-data.org/86.png"` | URL del escudo oficial del club |
| `valor` | `number` | No | `425.50` | Valor del token en créditos (DECIMAL 10,2) |
| `score` | `number` | No | `0.912400` | Score normalizado de rendimiento (DECIMAL 8,6) |
| `strategyName` | `string` | No | `"Estrategia Balanceada v1"` | Nombre de la estrategia que calculó el quote |
| `matchesPlayed` | `number` | Sí | `15` | Partidos jugados en la temporada |
| `passesCompleted` | `number` | Sí | `32.5` | Promedio de pases completados |
| `shots` | `number` | Sí | `4.2` | Promedio de remates por partido |
| `interceptions` | `number` | Sí | `0.4` | Promedio de intercepciones |
| `rating` | `number` | Sí | `8.12` | Calificación promedio |
| `goals` | `number` | Sí | `14` | Goles totales en la temporada |
| `assists` | `number` | Sí | `6` | Asistencias totales |
| `keyPasses` | `number` | Sí | `28` | Pases clave totales |
| `dribbles` | `number` | Sí | `35` | Regates exitosos |
| `totalTackles` | `number` | Sí | `5` | Entradas totales |
| `yellowCards` | `number` | Sí | `1` | Tarjetas amarillas |
| `redCards` | `number` | Sí | `0` | Tarjetas rojas |

### 2.3 Response Container: `PlayerRankingListResponseDto`
Estructura idéntica de paginación a `PlayerListResponseDto`.

| Campo | Tipo | Ejemplo | Descripción |
|---|---|---|---|
| `items` | `PlayerRankingResponseDto[]` | `[...]` | Lista de jugadores ordenados para la página actual |
| `total` | `number` | `150` | Cantidad total de jugadores con cotización que cumplen los filtros |
| `page` | `number` | `1` | Página actual |
| `pageSize` | `number` | `10` | Cantidad de elementos por página |

---

## 3. Tablas de Persistencia Involucradas

No se introducen tablas nuevas ni se modifican esquemas existentes. Se consultan las tablas:
1. `players`: Filtros de `removed_at IS NULL`, `league`, `position`, `team`.
2. `player_quotes`: Snapshot de cotización (`score`, `value`, `calculated_at`, `strategy_id`).
3. `valuation_strategies`: Nombre de la estrategia (`name`).
4. `teams`: Enriquecimiento del escudo (`crest_url`).

