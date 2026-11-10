# Data Model: Métricas técnicas (latencia y tasa de error) y SLA por endpoint

Esta feature **no persiste datos** (sin tablas ni migraciones). Las entidades de la spec son series en memoria del
proceso y una tabla de objetivos declarada en código.

## Métricas expuestas (exactamente dos familias)

### `http_request_duration_seconds` (histograma)

| Atributo | Valor |
|----------|-------|
| Unidad | segundos (la duración de `pino-http` en milisegundos / 1000) |
| Etiquetas | `method`, `route`, `status_code` |
| Intervalos (`le`) | `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.8, 1, 2.5, 5, 10, +Inf` |
| Series derivadas | `_bucket`, `_sum`, `_count` por combinación de etiquetas |
| No incluye | las respuestas de streams (`content-type: text/event-stream`) |

### `http_requests_total` (contador)

| Atributo | Valor |
|----------|-------|
| Etiquetas | `method`, `route`, `status_code` |
| Incluye | **toda** request, también las de stream |
| Uso | tasa de requests y tasa de error (`status_code=~"5.."` sobre el total del endpoint) |

## Etiquetas y su cardinalidad

| Etiqueta | Valores posibles | Cota |
|----------|------------------|------|
| `method` | `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS` u `OTHER` | 8 |
| `route` | patrón de ruta registrado (`/players/:id`, `/orders`, …) o `unmatched` | número de rutas de controller + 1 |
| `status_code` | código HTTP de la respuesta como texto | acotada por los códigos que emite el sistema |

Reglas de `route`:
- Es `req.route.path` (el patrón), nunca el path crudo, ni ids ni query.
- Una ruta ausente (404, 400 rechazado por el body parser, `OPTIONS` de CORS) o con comodín (`*`) → `unmatched`.
- Una request rechazada por un guard (401/403) conserva el patrón de su ruta.

## Objetivo de SLA (`SlaClass`)

Declarado en `shared/observability/metrics/sla.ts` y aplicado con `@Sla('<clase>')` en cada handler.

| Clase | p95 (ms) | Tasa 5xx máx. | Endpoints (de la spec) |
|-------|---------:|--------------:|------------------------|
| `auth` | 600 | 0,5 % | `POST /auth/register`, `POST /auth/login`, `POST /auth/api-key` |
| `read` | 300 | 0,5 % | `GET /auth/me`, `GET /players`, `GET /players/:id`, `GET /players/:id/quotes`, `GET /players/:id/order-book`, `GET /users/:id/portfolio`, `GET /orders`, `GET /orders/history`, `GET /alerts`, `GET /notifications`, `GET /users/me/strategies` |
| `read-computed` | 800 | 0,5 % | `GET /players/ranking`, `GET /players/:id/valuation` |
| `write` | 500 | 0,5 % | `POST /alerts`, `DELETE /alerts/:id`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `PATCH /users/me/strategies/:id/select`, `…/weights`, `…/position-weights/:position` |
| `market` | 800 | 0,5 % | `POST /orders`, `DELETE /orders/:id` |
| `system-trigger` | 1000 | 1 % | `POST /sync/whoscored`, `POST /sync/football-data` |
| `system-status` | 300 | 1 % | `GET /sync/whoscored/:runId` |
| `system-long` | — | 1 % | `POST /quotes/recalculate`, `POST /admin/simulate-market` |
| `stream` | — | 0,5 % | `GET /notifications/stream` |
| `ping` | 100 | 0,5 % | `GET /` |
| `technical` | 250 | 0,5 % | `GET /health`, `GET /metrics` |

`—` en p95 = no aplica (operación de larga duración o conexión abierta). La tabla por endpoint de la spec es la
referencia legible; la fuente verificable es este archivo.

## Identificador de un endpoint

`"<MÉTODO> <patrón>"`, por ejemplo `GET /players/:id/quotes`. Es el mismo texto que resulta de combinar las
etiquetas `method` y `route`, y es la clave con la que `sla-coverage` compara el SLA contra el router real.

## Invariantes

- Cada request cuenta exactamente una vez en `http_requests_total`, en el mismo instante en que `pino-http` emite su línea de cierre.
- `Σ http_requests_total` (en una ventana) = cantidad de líneas de cierre del log de requests de la misma ventana.
- `http_request_duration_seconds_count` ≤ `http_requests_total` por serie; son iguales salvo en los streams.
- Todo umbral de latencia de `SLA_CLASSES` está en los intervalos del histograma.
- Un fallo al registrar una muestra no cambia la respuesta ni el log.
