# Quickstart: validar las métricas y el SLA

Guía de validación; el formato está en [contracts/metrics-api.md](contracts/metrics-api.md) y las reglas en
[data-model.md](data-model.md).

## Prerrequisitos

- Docker en marcha: `docker info` debe responder **antes** de correr integración/e2e (si está apagado, el setup de tests cae en silencio a la base de desarrollo y los e2e **borran datos**).
- `cd backend && pnpm install` (incluye `prom-client`).
- La 028 (logging) ya está en el historial de la rama; esta feature se apoya en su hook de finalización.

## 1. Automático

```bash
cd backend
pnpm test:unit        # shared/metrics, metrics.service/controller, hook, tsarch
pnpm test:e2e         # incluye test/metrics.e2e-spec.ts y test/sla-coverage.e2e-spec.ts
pnpm build
pnpm lint
```

Esperado: todo en verde. El e2e de métricas cubre: acceso sin token, sólo dos familias, 401 con su patrón,
**404 y 400 por JSON malformado bajo `route="unmatched"`**, 5xx forzado, un patrón con ids distintos = una serie,
50 URLs inexistentes sin series nuevas, stream contado pero fuera del histograma, y coincidencia con el log.
`sla-coverage` verifica SLA ⇔ rutas reales y umbrales ⊂ límites del histograma.

## 2. Manual (contra una base desechable, no la de desarrollo)

```bash
docker run -d --name t029_pg -e POSTGRES_PASSWORD=t029 -e POSTGRES_DB=t029 -p 5544:5432 postgres:16-alpine
cd backend && pnpm build
PORT=3101 DATABASE_URL="postgresql://postgres:t029@127.0.0.1:5544/t029" NODE_ENV=test LOG_LEVEL=info node dist/src/main
```

| Paso | Comando | Esperado |
|------|---------|----------|
| Público | `curl -i localhost:3101/metrics` | 200, `Content-Type: text/plain; charset=utf-8; version=0.0.4`, sin `Authorization` |
| Sólo dos familias | `curl -s localhost:3101/metrics \| grep '^# TYPE'` | `http_request_duration_seconds histogram` y `http_requests_total counter`, nada más |
| 404 | `curl -s localhost:3101/no-existe >/dev/null` y luego `/metrics` | `http_requests_total{method="GET",route="unmatched",status_code="404"} 1` |
| 400 de parser | `curl -s -H 'Content-Type: application/json' -d '{"a":' localhost:3101/auth/login` | `route="unmatched",status_code="400"` con método `POST` |
| 401 con su ruta | `curl -s localhost:3101/auth/me` | `route="/auth/me",status_code="401"` |
| Patrón, no path | dos `curl localhost:3101/players/<uuid-1>` y `<uuid-2>` | una sola serie `route="/players/:id"` |
| Cardinalidad | `for i in $(seq 1 50); do curl -s localhost:3101/x$i >/dev/null; done` | la cantidad de series `unmatched/404` no cambia |
| Stream | abrir y cortar `/notifications/stream?token=<jwt>` | está en `http_requests_total`, no en `http_request_duration_seconds_count` |
| Coincide con el log | contar líneas `"msg":"request completed"` en la consola vs. suma de `http_requests_total` | iguales (descontando la consulta en curso a `/metrics`) |
| Tasa de error | forzar un 5xx y calcular `5xx / total` de ese endpoint | sólo cuenta 5xx; los 4xx se ven aparte |

Al final: detener el backend y `docker rm -f t029_pg`.

## 3. Documentación

- Swagger (`/docs`): `GET /metrics` bajo la etiqueta `metrics`, respuesta 200 `text/plain`.
- Postman: correr «Métricas — públicas, sin token (200)» → aserciones en verde.
