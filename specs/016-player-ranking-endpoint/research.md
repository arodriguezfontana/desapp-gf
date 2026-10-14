# Research & Technical Decisions: Ranking de Jugadores (GET /players/ranking)

**Feature**: `016-player-ranking-endpoint`  
**Date**: 2026-10-14  

---

## Decision 1: Consulta SQL de Última Cotización mediante CTE y Window Function

### Contexto
El endpoint requiere listar los jugadores ordenados descendentemente por su cotización vigente (`valor`). Cada jugador puede tener múltiples registros históricos en la tabla `player_quotes`. Solo se deben considerar aquellos jugadores que posean al menos una cotización, y para cada uno se debe seleccionar únicamente el registro más reciente en función de `calculated_at`, independientemente de cuál haya sido la estrategia que lo generó.

### Decisión
Implementar la consulta en `TypeOrmPlayerRepository.findRanking` utilizando un Common Table Expression (CTE) con la función de ventana `ROW_NUMBER() OVER (PARTITION BY pq.player_id ORDER BY pq.calculated_at DESC)` y un `INNER JOIN` con la tabla `players`:

```sql
WITH latest_quotes AS (
  SELECT
    pq.player_id,
    pq.score,
    pq.value,
    pq.calculated_at,
    vs.name AS strategy_name,
    ROW_NUMBER() OVER (
      PARTITION BY pq.player_id
      ORDER BY pq.calculated_at DESC
    ) AS rn
  FROM player_quotes pq
  INNER JOIN valuation_strategies vs ON vs.id = pq.strategy_id
)
SELECT
  p.*,
  lq.value AS quote_value,
  lq.score AS quote_score,
  lq.strategy_name AS quote_strategy_name,
  lq.calculated_at AS quote_calculated_at
FROM latest_quotes lq
INNER JOIN players p ON p.id = lq.player_id
WHERE lq.rn = 1
  AND p.removed_at IS NULL
  -- Filtros opcionales:
  -- AND p.league = :league
  -- AND p.position = :position
  -- AND p.team ILIKE :team
ORDER BY lq.value DESC, lq.score DESC, p.id ASC
LIMIT :limit OFFSET :offset;
```

Para el total de registros:
```sql
WITH latest_quotes AS (
  SELECT
    pq.player_id,
    ROW_NUMBER() OVER (
      PARTITION BY pq.player_id
      ORDER BY pq.calculated_at DESC
    ) AS rn
  FROM player_quotes pq
)
SELECT COUNT(*)::int AS total
FROM latest_quotes lq
INNER JOIN players p ON p.id = lq.player_id
WHERE lq.rn = 1
  AND p.removed_at IS NULL
  -- Filtros opcionales...
```

### Rationale
1. **Determinismo y Rendimiento**: La función de ventana `ROW_NUMBER()` particionada por `player_id` y ordenada por `calculated_at DESC` está optimizada en PostgreSQL y evita consultas N+1 o subconsultas correlacionadas costosas.
2. **Exclusión Natural**: El `INNER JOIN` entre `latest_quotes` y `players` garantiza que los jugadores sin ninguna cotización queden automáticamente excluidos de la consulta sin requerir filtros adicionales.
3. **Filtro de Bajas**: La condición `p.removed_at IS NULL` mantiene la consistencia con el catálogo de jugadores vigentes.
4. **Desempate Determinista**: La cláusula `ORDER BY lq.value DESC, lq.score DESC, p.id ASC` garantiza paginación estable y sin duplicados ante jugadores con el mismo valor económico.

### Alternativas Consideradas
- **Subconsulta correlacionada `WHERE calculated_at = (SELECT MAX(calculated_at) ...)`**: Funciona pero sufre degradación de performance a medida que la tabla `player_quotes` crece y puede devolver múltiples filas si dos quotes compartieran idéntico timestamp. `ROW_NUMBER() = 1` rompe empates de timestamp de forma única.
- **Calcular el ranking en memoria en Node.js**: Cargar todos los jugadores y quotes a memoria viola el principio de paginación en base de datos establecido en la Constitución y no escala con el volumen de cotizaciones históricas.

---

## Decision 2: Precedencia de Rutas en NestJS (`GET /players/ranking` vs `GET /players/:id`)

### Contexto
En los controladores de NestJS/Express, las rutas se evalúan en el orden secuencial en el que están declaradas. Si `@Get(':id')` se declara antes de `@Get('ranking')`, la cadena `'ranking'` será capturada como parámetro `:id`, derivando en un intento de buscar un jugador con id `"ranking"` (lo que provocaría error 400 por no-UUID o 404).

### Decisión
Ubicar el método `@Get('ranking')` en `PlayerController` **estrictamente antes** de `@Get(':id')` y `@Get(':id/quote')`.

### Rationale
Asegura que las peticiones a `/players/ranking` sean interceptadas por el manejador de ranking sin colisionar con el parámetro de ruta `:id`.

---

## Decision 3: Enriquecimiento de Escudos y Cálculo de Posición `rank`

### Contexto
El ranking debe devolver tanto el `crestUrl` del equipo del jugador (igual que `GET /players`) como el atributo ordinal `rank` correspondiente a su posición en la clasificación (1..N).

### Decisión
1. **Cálculo de `rank` en la capa de Servicio**:
   En `PlayerEnrichmentService.getRankingWithCrests`, al mapear cada elemento de la página obtenida:
   ```ts
   rank = (pagination.page - 1) * pagination.pageSize + index + 1;
   ```
2. **Enriquecimiento de Escudo**:
   Reutilizar `this.teams.findByWhoScoredName(player.team)` existente en `PlayerEnrichmentService` para resolver `crestUrl`.
3. **Respeto a la Constitución (Principio I)**:
   - El DTO de entrada `ListPlayersQueryDto` (o `RankingFiltersDto`) se mapea a los tipos de dominio `PlayerFilters` y `PlayerPagination`.
   - `PlayerRepository` devuelve objetos de dominio enriquecidos con datos de cotización (`PlayerQuoteRankingItem` o tupla de dominio).
   - El controlador construye la respuesta final `PlayerRankingListResponseDto`.

---

## Decision 4: Reutilización de DTOs y Validación de Filtros

### Contexto
Los parámetros aceptados por `GET /players/ranking` son idénticos a `GET /players`: `league`, `position`, `team`, `page` y `pageSize`.

### Decisión
Crear o extender `RankingFiltersDto` (o reutilizar `ListPlayersQueryDto` bajo un alias semántico `PlayerRankingQueryDto`) utilizando las mismas validaciones de `class-validator` y `class-transformer`:
- `league`: `@IsOptional()`, validación contra enum `League`.
- `position`: `@IsOptional()`, validación contra enum `Position`.
- `team`: `@IsOptional()`, string sanitizado.
- `page`: `@IsOptional()`, `@Type(() => Number)`, `@Min(1)`. Default 1.
- `pageSize`: `@IsOptional()`, `@Type(() => Number)`, `@Min(1)`, `@Max(50)`. Default 10.

Ante filtros sin coincidencias o tabla de cotizaciones vacía, el sistema responde `200 OK` con `{ items: [], total: 0, page, pageSize }`.

