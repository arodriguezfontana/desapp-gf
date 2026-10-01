# Quickstart — Validación del catálogo de jugadores

Guía reproducible para levantar el entorno y verificar el flujo end-to-end. No
contiene código de implementación; el contrato está en
[contracts/player-api.md](./contracts/player-api.md) y el modelo en
[data-model.md](./data-model.md).

## Prerrequisitos

- Node ≥ 18 y `pnpm` 9.
- Postgres accesible (nativo o vía `backend/docker-compose.yml`, ya existente) con
  `DATABASE_URL` configurada en `backend/.env` — sin cambios respecto de lo que ya
  usan `001-user-auth`/`002-api-key-issuance`.
- Un usuario registrado y su ApiKey emitida (flujo de `001-user-auth` +
  `002-api-key-issuance`), para poder llamar a los endpoints del catálogo.

## Setup

```bash
cd backend
pnpm install     # sin dependencias nuevas
```

## Cargar el catálogo de prueba

```bash
cd backend
pnpm migration:run   # corre SeedPlayerCatalog contra DATABASE_URL; idempotente
```

En dev normal esto también corre solo al arrancar (`pnpm dev`/`pnpm start`, ver
`main.ts`); el comando manual es útil para inspeccionar o re-ejecutar sin levantar
el servidor.

## Arrancar el backend

```bash
cd backend
pnpm dev
# API en http://localhost:3000 — Swagger en http://localhost:3000/docs (candado ApiKeyAuth en /players)
```

## Obtener una ApiKey para probar

```bash
# 1. Registrarse (si no hay un usuario todavía)
curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"tester@mail.com","password":"Abcd1234!"}'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"tester@mail.com","password":"Abcd1234!"}' | jq -r .accessToken)

# 3. Emitir ApiKey
APIKEY=$(curl -s -X POST http://localhost:3000/auth/api-key -H "Authorization: Bearer $TOKEN" | jq -r .apiKey)
echo "$APIKEY"   # guardar: sólo se muestra una vez
```

## Escenarios de validación

### 1. Listado sin filtros (User Story 1 · FR-001, FR-007, FR-008)

```bash
curl -s http://localhost:3000/players -H "x-api-key: $APIKEY" | jq
```

**Esperado**: `200`, `total: 20`, `items` con 10 jugadores (`page=1`, `pageSize=10`
por defecto).

### 2. Las 20 combinaciones liga+posición tienen resultado (spec FR-003, SC-001)

```bash
for league in "Premier League" "Bundesliga" "La Liga" "Serie A" "Ligue 1"; do
  for position in GK DF MF FW; do
    total=$(curl -s -G http://localhost:3000/players \
      --data-urlencode "league=$league" --data-urlencode "position=$position" \
      -H "x-api-key: $APIKEY" | jq .total)
    echo "$league / $position -> total=$total"
  done
done
```

**Esperado**: las 20 combinaciones imprimen `total=1`. Ninguna imprime `0`.

### 3. Filtro sin resultados (FR-009 · SC-006)

```bash
curl -s -G http://localhost:3000/players --data-urlencode "team=Equipo Inexistente" \
  -H "x-api-key: $APIKEY" | jq
```

**Esperado**: `200`, `items: []`, `total: 0` — no un error.

### 4. Paginación (FR-007, FR-008)

```bash
curl -s -G http://localhost:3000/players --data-urlencode "page=2" --data-urlencode "pageSize=5" \
  -H "x-api-key: $APIKEY" | jq
```

**Esperado**: `200`, 5 jugadores (posiciones 6 a 10 del conjunto sin filtrar),
`total: 20`.

### 5. Valores fuera de rango (Edge Cases)

```bash
curl -i -G http://localhost:3000/players --data-urlencode "pageSize=51" -H "x-api-key: $APIKEY"   # 400
curl -i -G http://localhost:3000/players --data-urlencode "position=XX" -H "x-api-key: $APIKEY"    # 400
curl -i -G http://localhost:3000/players --data-urlencode "page=0" -H "x-api-key: $APIKEY"          # 400
```

**Esperado**: `400` en los tres casos.

### 6. Detalle existente e inexistente (User Story 2 · FR-002, FR-010)

```bash
ID=$(curl -s http://localhost:3000/players -H "x-api-key: $APIKEY" | jq -r '.items[0].id')
curl -i http://localhost:3000/players/$ID -H "x-api-key: $APIKEY"                        # 200
curl -i http://localhost:3000/players/00000000-0000-0000-0000-000000000000 -H "x-api-key: $APIKEY"  # 404
```

### 7. `ApiKeyGuard` — rechazos (User Story 3 · FR-011, FR-012)

```bash
curl -i http://localhost:3000/players                                              # sin header -> 401
curl -i http://localhost:3000/players -H 'x-api-key: pmk_invalida'                  # inexistente -> 401
curl -i http://localhost:3000/players -H "Authorization: Bearer $TOKEN"             # sólo JWT -> 401
```

Para el caso "ApiKey revocada": emitir una segunda ApiKey para el mismo usuario
(`POST /auth/api-key` de nuevo) y reintentar el listado con la **primera**
(guardada en el paso de setup) — debe dar 401.

## Verificación automatizada

```bash
cd backend
pnpm test:unit            # dominio (League/Position/Player), guard, filtro, arquitectura (tsarch) — SIN Docker
pnpm test:integration     # PlayerService + TypeOrmPlayerRepository contra Postgres efímero (Testcontainers)
pnpm test:e2e             # supertest: migration de seed + 20 combinaciones + paginación + 404 + ApiKeyGuard
pnpm test                 # = unit + integration
pnpm lint
pnpm build
```

## Checklist de "terminado" (Principio X)

- [ ] `pnpm test`, `pnpm test:integration` y `pnpm test:e2e` en verde (casos felices y borde).
- [ ] `pnpm build` y `pnpm dev` levantan sin error con la config local.
- [ ] Swagger (`/docs`) muestra `GET /players` y `GET /players/:id` con sus schemas y el candado `ApiKeyAuth`.
- [ ] `docs/postman/desapp.postman_collection.json` actualizado con ambos requests (header `x-api-key`).
- [ ] Sin cambios a `.env.example` ni a `database.module.ts`.
