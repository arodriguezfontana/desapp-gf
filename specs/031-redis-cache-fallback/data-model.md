# Data Model & Schema Changes: Caché Redis y Optimización de Base de Datos

**Feature**: `031-redis-cache-fallback` | **Date**: 2026-11-17

Este documento describe las estructuras de datos almacenadas en la capa de memoria distribuida (Redis), los contratos de serialización y los cambios de esquema (índices compuestos) introducidos en PostgreSQL mediante TypeORM.

---

## 1. Esquema de Entidades en Redis

Redis almacena pares clave-valor serializados en formato JSON. Se utiliza el prefijo `futval:` como namespace global para evitar colisiones.

### 1.1. Catálogo General de Jugadores
- **Patrón de clave**: `futval:catalog:<hash>`
  - Donde `<hash>` es el hash SHA-256 (primeros 16 caracteres) de `{ league, position, team, page, pageSize }` con claves ordenadas alfabéticamente.
- **TTL**: 3600 segundos (1 hora).
- **Estructura del Payload (JSON)**:
  ```json
  {
    "items": [
      {
        "id": "e2a44d21-7b08-4122-bc57-f9d2d0b54130",
        "name": "Bukayo Saka",
        "league": "Premier League",
        "team": "Arsenal",
        "position": "FW",
        "crestUrl": "https://crests.football-data.org/57.png",
        "matchesPlayed": 10,
        "rating": 7.65,
        "goals": 4,
        "assists": 7
      }
    ],
    "total": 946,
    "page": 1,
    "pageSize": 10
  }
  ```

### 1.2. Detalle Individual de Jugador
- **Patrón de clave**: `futval:player:<playerId>`
  - Donde `<playerId>` es el UUID del jugador.
- **TTL**: 3600 segundos (1 hora).
- **Estructura del Payload (JSON)**:
  ```json
  {
    "id": "e2a44d21-7b08-4122-bc57-f9d2d0b54130",
    "name": "Bukayo Saka",
    "league": "Premier League",
    "team": "Arsenal",
    "position": "FW",
    "crestUrl": "https://crests.football-data.org/57.png",
    "matchesPlayed": 10,
    "passesCompleted": 32.4,
    "shots": 2.8,
    "interceptions": 0.5,
    "rating": 7.65,
    "goals": 4,
    "assists": 7,
    "keyPasses": 28,
    "dribbles": 22,
    "totalTackles": 14,
    "yellowCards": 1,
    "redCards": 0
  }
  ```

### 1.3. Ranking Personal de Jugadores
- **Patrón de clave**: `futval:ranking:<userId>:<hash>`
  - Donde `<userId>` es el UUID del usuario autenticado y `<hash>` corresponde a los filtros y paginación `{ league, position, team, page, pageSize }`.
- **TTL**: 86400 segundos (24 horas) o hasta invalidación explícita por recálculo / cambio de estrategia.
- **Estructura del Payload (JSON)**:
  ```json
  {
    "items": [
      {
        "rank": 1,
        "valor": 125400.50,
        "score": 0.885412,
        "strategyName": "Estrategia Ofensiva",
        "calculatedAt": "2026-11-15T03:00:00.000Z",
        "player": {
          "id": "e2a44d21-7b08-4122-bc57-f9d2d0b54130",
          "name": "Bukayo Saka",
          "league": "Premier League",
          "team": "Arsenal",
          "position": "FW",
          "crestUrl": "https://crests.football-data.org/57.png"
        }
      }
    ],
    "total": 946,
    "page": 1,
    "pageSize": 10
  }
  ```

### 1.4. Datos Externos Cacheados (Fallback de APIs)
- **Patrón de clave**: `futval:external:team-crest:<whoScoredName>` o `futval:external:standings:<leagueCode>`
- **TTL**: 604800 segundos (7 días).
- **Payload**: Respuesta estructurada de la API externa o URL del escudo (`string | null`).

---

## 2. Cambios en Base de Datos Relacional (PostgreSQL)

Se incorporan dos índices compuestos medidos mediante una nueva migración TypeORM: `AddPerformanceIndexes1793200000000.ts`.

### 2.1. Índice en Tabla `players`
- **Nombre**: `idx_players_removed_league_position`
- **Definición**:
  ```sql
  CREATE INDEX IF NOT EXISTS "idx_players_removed_league_position"
    ON "players" ("removedAt", "league", "position");
  ```
- **Justificación**: Acelera consultas de catálogo (`findPage`) y de ranking (`findRanking`) que filtran jugadores activos (`WHERE "removedAt" IS NULL`) combinados con filtros de liga o posición, transformando *Sequential Scans* en *Index Scans*.

### 2.2. Índice en Tabla `player_quotes`
- **Nombre**: `idx_player_quotes_user_player_calc_desc`
- **Definición**:
  ```sql
  CREATE INDEX IF NOT EXISTS "idx_player_quotes_user_player_calc_desc"
    ON "player_quotes" ("user_id", "player_id", "calculated_at" DESC);
  ```
- **Justificación**: Acelera la resolución de la cotización más reciente de cada jugador para un usuario determinado (`WHERE user_id = $1 PARTITION BY player_id ORDER BY calculated_at DESC`), evitando que PostgreSQL realice un ordenamiento general en memoria (*Sort*) sobre millones de registros históricos.

---

## 3. Optimización de la Consulta SQL de Ranking

### Antes (Consulta Original en `PlayerRepository.findRanking`):
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
  WHERE pq.user_id = $1
)
SELECT
  p.*,
  lq.value AS quote_value,
  lq.score AS quote_score,
  lq.strategy_name AS quote_strategy_name,
  lq.calculated_at AS quote_calculated_at
FROM latest_quotes lq
INNER JOIN players p ON p.id = lq.player_id
WHERE lq.rn = 1 AND p."removedAt" IS NULL [AND p."league" = $2 ...]
ORDER BY lq.value DESC, lq.score DESC, p.id ASC
LIMIT $N OFFSET $M;
```

### Después (Consulta Optimizada con Índice Compuesto):
Con el índice `(user_id, player_id, calculated_at DESC)`, el planificador de PostgreSQL ejecuta un *Index Scan* para recuperar directamente la primera fila de cada `player_id` para ese `user_id`. El conteo de totales (`countSql`) se beneficia directamente del índice y, en caso de acierto de caché en Redis, esta consulta no se ejecuta en absoluto.
