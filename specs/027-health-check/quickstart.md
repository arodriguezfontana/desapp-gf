# Quickstart: validar el health check

Guía de validación; los detalles de forma están en [contracts/health-api.md](contracts/health-api.md) y
[data-model.md](data-model.md).

## Prerrequisitos

- Docker en marcha (Testcontainers para los tests; `docker-compose` para la base local).
- `cd backend && pnpm install` (incluye `@nestjs/terminus@^11.1.1`).
- `backend/.env` con `DATABASE_URL` válida (sin variables nuevas).

## 1. Automático

```bash
cd backend
pnpm test:unit        # health.service.spec / health.controller.spec / architecture.spec (tsarch)
pnpm test:e2e         # incluye test/observability/health.e2e-spec.ts y protected.e2e-spec.ts
pnpm build            # nest build sin errores
pnpm lint
```

Esperado: todo en verde. `health.e2e-spec` cubre: 200 sin token, 503 por consulta rechazada, 503 por consulta
colgada (< 5 s), recuperación sin reinicio, ausencia de texto sensible, y sólo `database` en `details`.

## 2. Manual (base local)

```bash
cd backend && docker compose up -d && pnpm dev
```

| Paso | Comando | Esperado |
|------|---------|----------|
| Base sana | `curl -i http://localhost:3000/health` | `200`, `status: "ok"`, `details.database.status: "up"` |
| Sin token | mismo comando, sin `Authorization` | `200` (nunca `401`) |
| Base caída | `docker compose stop` (el servicio de Postgres) y repetir | `503`, `status: "error"`, `error.database.status: "down"`, respuesta en ≤ ~3 s |
| Recuperación | `docker compose start` y repetir | Vuelve a `200` sin reiniciar el backend |
| Sin fuga | inspeccionar el body en los casos anteriores | Sin URL de conexión, usuario, password ni stack trace |
| Proveedores externos | con la base sana, bloquear salida a internet y repetir | Sigue `200`; el endpoint no genera tráfico a Football-Data/WhoScored |
| Resto protegido | `curl -i http://localhost:3000/auth/me` | `401` |

## 3. Documentación

- Swagger (`/docs`): el endpoint aparece bajo la etiqueta `health` con respuestas 200 y 503.
- Postman: correr «Root y Health — públicos, sin token» contra una base sana → aserciones en verde.
