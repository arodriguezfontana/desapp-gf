# Data Model: Logging estructurado y trazabilidad de requests

Esta feature **no persiste datos**: sin tablas, migraciones ni cambios de esquema. Las entidades de la spec son
registros de salida (stdout) y un identificador en memoria por request.

## Entrada de log de request (`RequestLogEntry`)

Una línea JSON emitida por request al cerrarse (`finish`/`close`). Claves finales (el nombre es el contrato):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `level` | número pino (30 info, 40 warn, 50 error) | `info` 2xx/3xx, `warn` 4xx, `error` 5xx |
| `time` | epoch ms | Marca de tiempo de la entrada |
| `correlationId` | string | Correlation ID de la request |
| `req.method` | string | Método HTTP |
| `req.url` | string | Ruta + query con valores sensibles reemplazados por `[REDACTED]` |
| `route` | string (opcional) | Patrón de la ruta resuelta (`/players/:id`); ausente en 404/400 de parser |
| `params` | objeto | Parámetros de ruta (ya redactados); `{}` si no hay |
| `query` | objeto | Parámetros de query (ya redactados) |
| `userId` | string | UUID del usuario autenticado o `"anónimo"` |
| `body` | objeto (opcional) | Cuerpo del request redactado; ausente si no hay cuerpo. Puede ser `{ _truncated: true, preview }` |
| `res.statusCode` | número | Código de respuesta |
| `responseTime` | número | Duración en milisegundos |
| `msg` | string | `request completed` o `request aborted` / `request errored` |
| `err` | — | No se emite: el stack real de un 5xx lo loguea `AllExceptionsFilter` (ver contrato §3) |

Nunca aparecen: headers de request o de respuesta, cuerpo de respuesta, email, nombre de usuario, contraseñas, tokens, API keys.

Otras entradas del backend (arranque, servicios, filtro de excepciones, cron) usan el mismo formato JSON con `level`,
`time`, `context`, `msg`; las emitidas durante una request llevan además `correlationId`.

## Correlation ID

| Atributo | Regla |
|----------|-------|
| Origen | Header `X-Correlation-Id` entrante si es válido; si no, `randomUUID()` |
| Validez | String de 1 a 64 caracteres que cumple `^[A-Za-z0-9._:-]+$` |
| Alcance | Una request. Se comparte entre requests sólo si el cliente envía el mismo valor (reintentos) |
| Salida | Header `X-Correlation-Id` en toda respuesta; campo `correlationId` en toda entrada emitida durante la request |
| Almacenamiento | Contexto asíncrono por request (en memoria); no se persiste |

## Campo sensible

| Regla | Valor |
|-------|-------|
| Coincidencia | Nombre de clave que cumple `/pass|token|secret|api.?key|authorization|credential|email|user.?name/i`, sin distinguir mayúsculas, a cualquier profundidad (objetos y arreglos) |
| Reemplazo | Texto fijo `[REDACTED]` (nunca el valor, ni parcial) |
| Aplica a | Cuerpo del request, `query`, `params` y la query dentro de `req.url` |
| No aplica a | Cuerpo de respuesta (no se loguea) |

## Configuración de logging (`LogConfig`)

| Campo | Origen | Default |
|-------|--------|---------|
| `level` | Variable de entorno opcional `LOG_LEVEL` | `debug` si `NODE_ENV=development`; `silent` si `NODE_ENV=test`; `info` en otro caso |
| `stream` | Destino de escritura | stdout; sobrescribible en tests para capturar |

## Invariantes

- Toda request tiene exactamente un Correlation ID y exactamente una entrada de cierre.
- `userId` es siempre un string (UUID o `"anónimo"`), nunca `null`.
- El JSON de una entrada no tiene claves duplicadas.
- El logging no muta la request ni la respuesta, y un fallo al armar o escribir el log no cambia la respuesta.
