# Quickstart: Disparo manual de sincronización

**Feature**: `009-manual-sync-trigger` | **Date**: 2026-10-06

Guía para validar la feature de punta a punta. Contratos en [contracts/sync-api.md](./contracts/sync-api.md), tipos en [data-model.md](./data-model.md).

## Prerrequisitos

- Backend instalado (`pnpm install` en `backend/`).
- Docker disponible: los tests de integración y e2e levantan Postgres con Testcontainers.
- Para las pruebas manuales: Postgres local, `backend/.env` con `DATABASE_URL`, `JWT_SECRET` y `FOOTBALL_DATA_API_TOKEN`, y una ApiKey emitida con `POST /auth/api-key`.

## 1. Tests automáticos

```bash
cd backend
pnpm test:unit          # locks, 409, runId, estados, retención, @Cron saltado
pnpm test:integration   # corrida real contra Postgres, adapter fake
pnpm test:e2e           # 401, 202 + GET, 409, football-data síncrono
```

Esperado: todo en verde, y **los tests existentes sin editar**. En particular, `player-sync.service.spec.ts` sigue aseverando `sync()` → `undefined`.

## 2. Autenticación (US3)

Sin header, con una clave inexistente y con una clave revocada, cada uno de estos devuelve `401` y no inicia ninguna sincronización:

```bash
curl -i -X POST http://localhost:3000/sync/whoscored
curl -i -X POST http://localhost:3000/sync/football-data
curl -i http://localhost:3000/sync/whoscored/cualquier-id
```

Con solo un JWT (`Authorization: Bearer ...`) y sin `x-api-key`, también `401`.

## 3. WhoScored asincrónico (US1)

1. `POST /sync/whoscored` con `x-api-key`. Esperado: `202` con `runId` y `status: "running"`, de inmediato.
2. `GET /sync/whoscored/{runId}` repetido hasta `status: "completed"`. Esperado: `teamsSynced`, `playersSynced` y `failedUnits`.
3. Los conteos coinciden con los cambios del catálogo (`GET /players`).

La corrida real de WhoScored tarda varios minutos y consume cuota del sitio. Para una prueba manual rápida conviene un entorno con el adapter reemplazado o una sola liga.

## 4. Football-Data sincrónico (US2)

`POST /sync/football-data` con `x-api-key`. La request espera ~70 s. Esperado: `200` con `leagues` (una entrada por liga) y `failedLeagues`.

## 5. Lock (FR-015)

1. Con una corrida de WhoScored en curso, repetir `POST /sync/whoscored`. Esperado: `409` con el `runId` **de la corrida en curso**.
2. Con una corrida de Football-Data en curso, repetir `POST /sync/football-data`. Esperado: `409` inmediato.
3. Con una corrida manual en curso, la ejecución del `@Cron` de esa feature se salta y deja una advertencia en el log. Se cubre con el test unitario, no manualmente (el `@Cron` es semanal).

## 6. `runId` desconocido

`GET /sync/whoscored/00000000-0000-0000-0000-000000000000` con ApiKey válida. Esperado: `404`. Lo mismo ocurre con un `runId` válido después de reiniciar el servidor.

## 7. Documentación (FR-012)

- Swagger (`/docs`): los tres endpoints aparecen bajo su tag, con `ApiKeyAuth` y los códigos 202/200/401/404/409.
- Postman: la carpeta "Feature 9 — Sincronización manual" tiene los tres requests, con `{{apiKey}}`.

## Criterio de aceptación

- Los pasos 2 a 6 se cumplen sin editar código.
- `nest build` y `eslint` sin errores.
- Ningún test existente fue modificado (`git diff` sobre los `*.spec.ts` previos vacío).
