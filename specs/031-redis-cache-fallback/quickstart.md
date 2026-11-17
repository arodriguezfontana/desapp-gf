# Quickstart & Verification Guide: Caché Redis y Fallback

**Feature**: `031-redis-cache-fallback` | **Date**: 2026-11-17

Guía paso a paso para verificar en desarrollo local la aceleración por caché en Redis, la resiliencia en modo fail-open, el fallback ante fallos de APIs externas y la efectividad de los índices.

---

## 1. Levantar la infraestructura

Desde la carpeta `backend/`:

```bash
# Levantar PostgreSQL y Redis
docker compose up -d postgres redis

# Verificar que Redis responda
docker compose exec redis redis-cli ping
# Debe responder: PONG
```

---

## 2. Ejecutar la migración de índices

```bash
cd backend
pnpm migration:run
```

Verificar que se hayan creado los índices `idx_players_removed_league_position` y `idx_player_quotes_user_player_calc_desc`.

---

## 3. Comprobar aceleración y Cache Hit en el catálogo

1. Realizar una petición a `GET /players` y medir el tiempo:
   ```bash
   curl -i -H "X-Api-Key: $QUOTES_API_KEY" "http://localhost:3000/players?page=1&pageSize=10"
   ```
   *Resultado esperado*: Primera petición consulta Postgres (~30-50 ms).

2. Repetir la misma petición inmediatamente:
   ```bash
   curl -i -H "X-Api-Key: $QUOTES_API_KEY" "http://localhost:3000/players?page=1&pageSize=10"
   ```
   *Resultado esperado*: Segunda petición servida desde Redis (< 10 ms).

3. Inspeccionar las claves en Redis:
   ```bash
   docker compose exec redis redis-cli keys "futval:catalog:*"
   ```

---

## 4. Comprobar aislamiento e invalidación en el Ranking

1. Consultar `GET /players/ranking` con un token JWT de usuario:
   ```bash
   curl -i -H "Authorization: Bearer $USER_JWT" "http://localhost:3000/players/ranking?page=1&pageSize=10"
   ```
2. Verificar que se creó la clave en Redis:
   ```bash
   docker compose exec redis redis-cli keys "futval:ranking:*"
   ```
3. Disparar un recálculo manual de cotizaciones:
   ```bash
   curl -i -X POST -H "X-Admin-Api-Key: $ADMIN_API_KEY" "http://localhost:3000/quotes/recalculate"
   ```
4. Verificar que las claves de ranking se hayan purgado:
   ```bash
   docker compose exec redis redis-cli keys "futval:ranking:*"
   # Debe retornar lista vacía (empty list or set)
   ```

---

## 5. Comprobar resiliencia Fail-Open ante caída de Redis

1. Detener el contenedor de Redis:
   ```bash
   docker compose stop redis
   ```
2. Ejecutar nuevamente una consulta al catálogo:
   ```bash
   curl -i -H "X-Api-Key: $QUOTES_API_KEY" "http://localhost:3000/players?page=1&pageSize=10"
   ```
   *Resultado esperado*: HTTP 200 OK. La petición no falla; en los logs del backend se visualiza una advertencia `[RedisCacheService] Redis unavailable, failing open to database`.
3. Volver a encender Redis:
   ```bash
   docker compose start redis
   ```

---

## 6. Comprobar Fallback ante fallas de API externa

1. Configurar un token inválido o desconectar temporalmente el acceso a `api.football-data.org`.
2. Consultar el detalle de un jugador o catálogo:
   ```bash
   curl -i -H "X-Api-Key: $QUOTES_API_KEY" "http://localhost:3000/players"
   ```
3. *Resultado esperado*: HTTP 200 OK. El backend no propaga errores 500 y sirve los escudos previamente persistidos en PostgreSQL o `null` si no existieran, emitiendo un log `warn`.
