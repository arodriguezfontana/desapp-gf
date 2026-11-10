# Quickstart: validar el logging estructurado

Guía de validación; el formato de las líneas está en [contracts/request-logging.md](contracts/request-logging.md) y
[data-model.md](data-model.md).

## Prerrequisitos

- Docker en marcha (`docker info` debe responder **antes** de correr integración/e2e: si está apagado, el setup de tests cae en silencio a la base de desarrollo y los e2e borran datos).
- `cd backend && pnpm install` (incluye `nestjs-pino`, `pino-http`, `pino`).
- `backend/.env` con `DATABASE_URL`; `LOG_LEVEL` es opcional.

## 1. Automático

```bash
cd backend
pnpm test:unit        # shared/logging/*.spec, cors, tsarch
pnpm test:e2e         # incluye test/request-logging.e2e-spec.ts
pnpm build
pnpm lint
```

Esperado: todo en verde. El e2e cubre header en 200/401/404/400-parser, id entrante válido e inválido, campos del
log, concurrencia, Correlation ID en el log del filtro ante un 5xx, una sola línea por 4xx, y ausencia de contraseña/email/username/JWT/API key en toda
línea capturada.

## 2. Manual

```bash
cd backend && pnpm dev          # o: pnpm dev:pretty para leer la salida más cómoda
```

| Paso | Comando | Esperado |
|------|---------|----------|
| Id generado | `curl -i localhost:3000/` | Header `X-Correlation-Id: <uuid>`; en consola una línea JSON con ese `correlationId` |
| Id entrante | `curl -i -H 'X-Correlation-Id: mi-id-1' localhost:3000/` | Mismo valor en el header y en el log |
| Id inválido | `curl -i -H 'X-Correlation-Id: a b"c' localhost:3000/` | Header con un UUID distinto |
| 404 | `curl -i localhost:3000/nope` | 404 con header y línea de log (`userId: "anónimo"`) |
| 401 | `curl -i localhost:3000/auth/me` | 401 con header y **una sola** línea de log (`warn`); el filtro no la repite |
| JSON inválido | `curl -i -H 'Content-Type: application/json' -d '{"a":' localhost:3000/auth/login` | 400 con header y línea de log |
| Secretos | `curl -s -H 'Content-Type: application/json' -d '{"email":"x@y.com","password":"Abcd1234!"}' localhost:3000/auth/login` | En el log: `"password":"[REDACTED]"`, `"email":"[REDACTED]"` (y `"username":"[REDACTED]"` en el registro); nunca el valor original ni el token de la respuesta |
| Token en URL | abrir `/notifications/stream?token=<jwt>` | La URL del log termina en `token=[REDACTED]` |
| Traza completa | `docker`/consola → filtrar por un id (`jq 'select(.correlationId=="mi-id-1")'`) | Todas las líneas de esa operación y ninguna de otra |
| Sólo JSON | arrancar y mirar la consola | Ninguna línea en texto plano (arranque incluido) |

## 3. CORS y documentación

- Con el frontend en `http://localhost:5173`: `fetch(...).then(r => r.headers.get('X-Correlation-Id'))` devuelve el valor (no `null`).
- Swagger (`/docs`): la descripción global menciona `X-Correlation-Id`.
- Postman: la colección tiene la nota y el test a nivel colección; correrla con la base sana deja las aserciones en verde.
