# Quickstart — Catálogo de Jugadores con Datos Reales (WhoScored)

Guía de validación end-to-end. No sustituye a `contracts/player-api.md`
(forma exacta de la respuesta) ni a `data-model.md` (entidades) — sólo enlaza
a ellos y da los pasos para probarlo en un entorno local.

## Prerrequisitos

- `004-player-catalog` y `005-frontend-player-catalog` ya mergeadas en la
  rama (`GET /players`/`GET /players/:id` funcionando con `ApiKeyGuard`).
- Docker corriendo (`docker compose up -d` desde `backend/`, Postgres local).
- `backend/.env` con `DATABASE_URL` apuntando a ese Postgres.
- Una ApiKey emitida (`POST /auth/api-key` autenticado, ver
  `specs/002-api-key-issuance`) — los endpoints del catálogo la siguen
  exigiendo sin cambios.

## 1. Instalar dependencias nuevas

```bash
cd backend
pnpm add @nestjs/schedule got-scraping@3.2.15 cheerio
```

(research.md §0: `@nestjs/schedule` no estaba instalado pese a la
precondición del pedido; `got-scraping`/`cheerio` son nuevas, exclusivas del
Adapter — research.md §4. `got-scraping` va pinneado a `3.2.15` exacto, no
`^3.2.15`: la rama `4.x` es ESM-only e incompatible con el `commonjs` de este
proyecto.)

## 2. Levantar el backend (corre las migrations nuevas al boot)

```bash
pnpm dev
```

`runPlayerCatalogMigrations()` (ya existente, sin cambios de infra) corre las
dos migrations nuevas de esta feature al iniciar (data-model.md § Migrations):
agrega las columnas de WhoScored a `players` y borra los 20 jugadores de
prueba de `004`. Verificar que el catálogo queda vacío hasta la primera
sincronización:

```bash
curl -H "x-api-key: <tu-api-key>" http://localhost:3000/players
# => { "items": [], "total": 0, "page": 1, "pageSize": 10 }  (Edge Case: ninguna sincronización exitosa todavía)
```

## 3. Disparar una sincronización manual (sin esperar al cron semanal)

En este entorno de validación local, invocar `PlayerSyncService.sync()`
directamente en lugar de esperar a `@Cron(CronExpression.EVERY_WEEK)` — por
ejemplo desde un script ad-hoc de Nest (`NestFactory.createApplicationContext`
+ `app.get(PlayerSyncService).sync()`) o un test manual. No existe (ni debe
existir, FR-008) un endpoint HTTP para esto.

Con conectividad real a WhoScored, la corrida completa puede tardar (research.md
§6: miles de páginas). Para una validación rápida, limitar temporalmente la
iteración a una sola liga/equipo es aceptable en un script de prueba manual,
sin que eso implique un cambio en `PlayerSyncService.sync()` (que siempre
recorre las 5 ligas completas en producción).

## 4. Verificar el catálogo con datos reales

```bash
curl -H "x-api-key: <tu-api-key>" \
  "http://localhost:3000/players?league=Premier%20League&position=FW&page=1&pageSize=10"
```

Verificar contra `contracts/player-api.md`:
- Los jugadores devueltos son reales (nombre, equipo real de esa liga).
- Cada uno trae `passesCompleted`/`shots`/`interceptions`/`rating` — con
  valor numérico o `null`, nunca ausentes del JSON.
- Filtros, paginación, `total`, 404 de `GET /players/:id` con un id
  inexistente, y los 4 casos de `ApiKeyGuard` (401) se comportan exactamente
  igual que en `004` (FR-001, FR-002) — repetir los mismos checks manuales
  que ya documentaba `specs/004-player-catalog/quickstart.md`.

## 5. Validar la degradación por niveles (liga / equipo / jugador)

Sin acceso a modificar WhoScored en vivo, estos tres casos se validan con la
suite automatizada (paso 6), no manualmente: son exactamente lo que cubren
los tests de `PlayerSyncService` con un `WhoScoredAdapter` fake que simula
cada tipo de falla (data-model.md § "Nuevo Service: PlayerSyncService").

## 6. Suite automatizada

```bash
pnpm test:unit         # incluye whoscored-position-mapping, team-roster-sync,
                        # PlayerSyncService (adapter fake), HttpWhoScoredAdapter
                        # (got-scraping mockeado + fixture HTML real, sin red)
pnpm test:integration  # incluye TypeOrmPlayerRepository.applyTeamRosterSync
                        # y findActiveExternalIdsByTeam contra Postgres real (Testcontainers)
pnpm test:e2e          # GET /players y GET /players/:id con datos sembrados
                        # directamente en la tabla (sin depender del scraping real)
```

Ninguno de estos tests hace una request real a `whoscored.com`
(`contracts/whoscored-adapter.md` § "Contrato de test").

## 7. Documentación

- Swagger (`/docs`): confirmar que `PlayerResponseDto` muestra los cuatro
  campos nuevos como `nullable`.
- `docs/postman/desapp.postman_collection.json`: los requests de
  `GET /players`/`GET /players/:id` ya existentes no cambian de URL ni de
  headers; alcanza con actualizar el ejemplo de respuesta guardado si el
  cliente Postman lo versiona (Principio X — Definición de terminado).
