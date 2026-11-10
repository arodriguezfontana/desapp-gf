# Contract: Metrics API

`ApiTags('metrics')`. El endpoint es `@Public()` (exento del `JwtAuthGuard` global): **no requiere JWT ni API key**,
igual que `/health`. Es de sólo lectura y no modifica estado.

## `GET /metrics`

Devuelve las métricas de requests del proceso en el formato de texto de Prometheus (spec FR-001..FR-003).

**Request**: sin parámetros, sin body, sin headers de autenticación.

**Response 200** (`Content-Type: text/plain; charset=utf-8; version=0.0.4`; Express ordena así los parámetros):

```text
# HELP http_request_duration_seconds Duración de las requests HTTP, en segundos
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",route="/players/:id",status_code="200"} 3
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/players/:id",status_code="200"} 8
http_request_duration_seconds_bucket{le="0.3",method="GET",route="/players/:id",status_code="200"} 9
...
http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/players/:id",status_code="200"} 9
http_request_duration_seconds_sum{method="GET",route="/players/:id",status_code="200"} 0.412
http_request_duration_seconds_count{method="GET",route="/players/:id",status_code="200"} 9
http_request_duration_seconds_count{method="GET",route="unmatched",status_code="404"} 41
http_request_duration_seconds_count{method="POST",route="unmatched",status_code="400"} 2
http_request_duration_seconds_count{method="GET",route="/auth/me",status_code="401"} 5
# HELP http_requests_total Requests HTTP atendidas
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/players/:id",status_code="200"} 9
http_requests_total{method="GET",route="unmatched",status_code="404"} 41
http_requests_total{method="POST",route="unmatched",status_code="400"} 2
http_requests_total{method="GET",route="/notifications/stream",status_code="200"} 1
```

**Errores**: ninguno distinto del normal. Nunca `401` (público).

### Reglas de contenido

- **Sólo dos familias**: `http_request_duration_seconds` y `http_requests_total`. Sin métricas del proceso ni de negocio.
- **Etiquetas**: `method` (conjunto cerrado o `OTHER`), `route` (patrón de ruta o `unmatched`), `status_code`. Nunca path crudo, query, ids, usuarios ni credenciales.
- `route="unmatched"` agrupa las rutas inexistentes (404), los rechazos antes de resolver la ruta (400 por JSON ilegible) y los `OPTIONS` de CORS; se separan por `method` y `status_code`.
- Los streams (`GET /notifications/stream`) aparecen en `http_requests_total` pero **no** en `http_request_duration_seconds`.
- Los contadores y las duraciones se reinician con el proceso; Prometheus lo maneja en `rate()`/`increase()`.

### Consultas de referencia (PromQL)

```text
# p95 de latencia de un endpoint
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{method="GET",route="/players/:id"}[5m])))

# tasa de error 5xx de un endpoint (sólo fallas del servicio, no 4xx)
sum(rate(http_requests_total{route="/orders",method="POST",status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total{route="/orders",method="POST"}[5m]))

# 4xx por separado (abuso o problemas de integración)
sum by (status_code) (rate(http_requests_total{status_code=~"4.."}[5m]))
```

## Declaración de SLA (junto al código)

Cada handler lleva `@Sla('<clase>')`; las clases y sus umbrales están en `backend/src/shared/metrics/sla.ts`
(ver [data-model.md](../data-model.md)). Un test e2e falla si un endpoint publicado no tiene SLA o un SLA no
corresponde a un endpoint, y comprueba que los umbrales de latencia están entre los límites del histograma.

## Impacto en documentación (Principios VIII y X)

- **Swagger**: `GET /metrics` con `@ApiOperation`, `@ApiProduces('text/plain')` y `@ApiResponse(200)`.
- **Postman**: request «Métricas — públicas, sin token (200)» con aserciones de `Content-Type` y de las dos familias.
