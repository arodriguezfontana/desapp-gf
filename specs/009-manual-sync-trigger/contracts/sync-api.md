# Contrato: endpoints de sincronización manual

**Feature**: `009-manual-sync-trigger` | **Date**: 2026-10-06

Los tres endpoints exigen `x-api-key` con una ApiKey activa. No aceptan JWT. Ninguno tiene pantalla de frontend. Los errores usan el formato único del `AllExceptionsFilter` (`statusCode`, `error`, `message`, `timestamp`, `path`).

## 1. `POST /sync/whoscored`

Dispara la sincronización de WhoScored en background.

**Headers**: `x-api-key: <ApiKey>`. **Body**: ninguno.

### 202 Accepted

```json
{
  "runId": "3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b",
  "status": "running"
}
```

### 409 Conflict

Ya hay una corrida de WhoScored en curso (manual o del `@Cron`). No se inicia otra.

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Ya hay una sincronización en curso.",
  "runId": "9b2d8c10-aaaa-4bbb-8ccc-0d1e2f3a4b5c",
  "timestamp": "2026-10-06T14:03:22.000Z",
  "path": "/sync/whoscored"
}
```

`runId` es el de la corrida **en curso**, no una nueva.

### 401 Unauthorized

Sin header, ApiKey inexistente o revocada, o solo un JWT. No se inicia ninguna sincronización.

## 2. `GET /sync/whoscored/:runId`

Estado de una corrida y, al terminar, su resumen.

### 200 OK — en curso

```json
{
  "runId": "3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b",
  "status": "running",
  "trigger": "manual",
  "startedAt": "2026-10-06T14:03:22.000Z"
}
```

### 200 OK — completada (con unidades fallidas)

```json
{
  "runId": "3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b",
  "status": "completed",
  "trigger": "manual",
  "startedAt": "2026-10-06T14:03:22.000Z",
  "finishedAt": "2026-10-06T14:09:51.000Z",
  "teamsSynced": 96,
  "playersSynced": 2412,
  "failedUnits": [
    { "league": "Ligue 1", "team": "Equipo X", "reason": "roster-fetch-failed" },
    { "league": "Serie A", "reason": "league-fetch-failed" }
  ]
}
```

`failedUnits` es un arreglo vacío si no falló nada. `team` no aparece cuando falló la liga completa.

### 200 OK — fallida

```json
{
  "runId": "3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b",
  "status": "failed",
  "trigger": "manual",
  "startedAt": "2026-10-06T14:03:22.000Z",
  "finishedAt": "2026-10-06T14:05:10.000Z",
  "teamsSynced": 12,
  "playersSynced": 310,
  "failedUnits": [],
  "errorMessage": "La sincronización se interrumpió por un error inesperado."
}
```

Los conteos son los acumulados hasta el punto de falla. El mensaje es fijo: nunca incluye texto de la excepción ni stack.

### 404 Not Found

`runId` inexistente, descartado por el tope de 20 corridas, o perdido por un reinicio del servidor.

### 401 Unauthorized

Sin ApiKey válida. No revela el estado de ninguna corrida.

## 3. `POST /sync/football-data`

Dispara la sincronización de Football-Data y **espera a que termine** (~70 s con el plan free).

**Headers**: `x-api-key: <ApiKey>`. **Body**: ninguno.

### 200 OK

```json
{
  "leagues": [
    { "leagueCode": "PL",  "standingsSynced": 20, "matchesSynced": 380, "failedSteps": [] },
    { "leagueCode": "BL1", "standingsSynced": 18, "matchesSynced": 306, "failedSteps": [] },
    { "leagueCode": "PD",  "standingsSynced": 0,  "matchesSynced": 0,   "failedSteps": ["standings", "matches"] },
    { "leagueCode": "SA",  "standingsSynced": 20, "matchesSynced": 380, "failedSteps": [] },
    { "leagueCode": "FL1", "standingsSynced": 18, "matchesSynced": 306, "failedSteps": [] }
  ],
  "failedLeagues": ["PD"]
}
```

El código es 200 aunque haya ligas fallidas: la respuesta describe lo que pasó (FR-010). `failedLeagues` es un arreglo vacío si no falló ninguna.

### 409 Conflict

Ya hay una corrida de Football-Data en curso (manual o del `@Cron`). Responde de inmediato, sin esperar y sin `runId`.

### 401 Unauthorized

Sin ApiKey válida. No se inicia ninguna sincronización.

## 4. Comportamiento del `@Cron`

No es un endpoint, pero cambia su comportamiento (FR-004, FR-015): el horario y la frecuencia no cambian. Si al dispararse ya hay una corrida de su feature en curso, **se salta** esa ejecución, deja una advertencia en el log y no reintenta hasta el próximo horario. No hay respuesta HTTP en ese caso.

## 5. Swagger

Los tres endpoints llevan `@ApiTags`, `@ApiSecurity('ApiKeyAuth')` y un `@ApiResponse` por código documentado arriba. El OpenAPI se genera desde los DTOs y decoradores; no se edita a mano.
