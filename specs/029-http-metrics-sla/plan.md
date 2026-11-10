# Implementation Plan: Métricas técnicas (latencia y tasa de error) y SLA por endpoint

**Branch**: `029-http-metrics-sla` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-http-metrics-sla/spec.md` + plan técnico aportado por el equipo (extender el hook de la 028, `MetricsModule` público, SLA junto a los controllers), verificado contra el código y con dos spikes ejecutables (ver [research.md](research.md)).

## Summary

Exponer `GET /metrics` (público) con dos métricas de `prom-client` —`http_request_duration_seconds`
(histograma) y `http_requests_total` (contador), ambas con las etiquetas `method`, `route` y `status_code`—
capturadas en el mismo hook de finalización de respuesta que ya usa el log de requests de la 028, para que
cada request cuente exactamente una vez en las dos fuentes y cubra 401/403/404/400. Además, declarar el SLA
(p95 + tasa de 5xx) de cada endpoint junto a su controller con un decorator, con una verificación automática
contra el router real.

El plan del equipo se adopta con **siete ajustes** que salieron de contrastarlo con el código de la 028 y con
los spikes:

1. **El hook de la 028 no es un `res.on('finish')` propio, y no resuelve `'unmatched'` todavía.** La 028 registra `pino-http`, que escucha `finish`/`close` por su cuenta y llama a `customSuccessObject`/`customErrorObject` con `val.responseTime`; la ruta se agrega al log sólo si existe (`req.route?.path`), sin fallback. Esta feature **extiende esos dos callbacks** (mismo disparo, mismos valores: `req.route`, `res.statusCode`, `val.responseTime`) y agrega el fallback `unmatched`. No crea middleware ni listener nuevo.
2. **Registro propio, no el global de `prom-client`.** Con `register` global, crear la segunda app Nest en el mismo proceso (los tests lo hacen) lanza `A metric with the name http_requests_total has already been registered` (verificado). Cada `MetricsService` tiene su `Registry`, y no se activan las métricas por defecto (la spec exige exactamente dos métricas).
3. **La etiqueta de ruta se endurece.** El router de Express tiene dos rutas comodín `{/*splat}` (las de los middleware de Nest): cualquier ruta con comodín se trata como `unmatched`, no como una ruta real.
4. **Faltaban tres reglas de la spec en el plan**: método HTTP acotado a un conjunto estándar (FR-008), el stream en vivo se cuenta pero no entra al histograma (FR-011) y los límites de los intervalos incluyen cada umbral de latencia declarado (FR-016).
5. **El SLA va en un decorator, no en un comentario.** La spec exige una verificación automática que falle si un endpoint no tiene SLA (FR-017); un comentario no se puede verificar. `@Sla('<clase>')` en cada handler + una tabla de clases en un solo archivo + un test que compara contra las rutas reales del router (33 rutas de controller, más las dos capas comodín que se excluyen; enumeradas en el spike).
6. **Rutas por capa** (`controllers/metrics/`, `services/metrics/`, `modules/metrics/`), igual que 027, y **`pnpm add`**, no `npm install`.
7. **La 028 está en el historial** (`95c384f`, rama `feat/core-3`); no pude verificar su estado en `main`.

Sobre el punto del plan "`unmatched` mezcla 404 y 400 del parser": estoy de acuerdo con no separarlos por etiqueta, y además **sí son distinguibles por `status_code`** (`unmatched/404` vs `unmatched/400`), así que no hace falta nada más.

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict`), Node.js 20, NestJS 11.2, Express 5

**Primary Dependencies**: `prom-client@^15.1.3` (nueva); ya presentes: `pino-http` (hook de finalización de la 028), `@nestjs/swagger`

**Storage**: N/A (métricas en memoria del proceso; se reinician con él). Sin migraciones

**Testing**: Jest unit (helpers, servicio, hook, decorator) y Jest + supertest e2e sobre `createTestApp()` con PostgreSQL efímero de Testcontainers; test de arquitectura tsarch existente

**Target Platform**: Servicio HTTP Linux/Docker, consultado por un scraper de Prometheus

**Project Type**: web-service (monorepo; sólo se toca `backend/` y `docs/postman/`)

**Performance Goals**: < 2 ms de sobrecosto por request (SC-007); `GET /metrics` p95 ≤ 250 ms

**Constraints**: exactamente dos métricas (sin métricas del proceso); cardinalidad acotada (ruta = patrón o `unmatched`; método de conjunto cerrado); sin datos de usuarios ni de requests en las etiquetas; un fallo de la recolección no altera la respuesta

**Scale/Scope**: ~7 archivos de producción nuevos, 1 decorator aplicado en 15 controllers existentes (33 handlers) más el nuevo, y 3 archivos editados (`request-log-options.ts`, `configure-request-logging.ts`, `app.module.ts`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Capas | ✅ | Controller → Service: `MetricsController` sólo habla con `MetricsService` (que usa `prom-client`, una librería sin regla de aislamiento en el principio ni en tsarch). El hook de la 028 (`shared/logging`) depende de una interfaz `RequestMetricsRecorder` en `shared/metrics`, no de `services/`, para no invertir capas |
| II. Dominio rico | ✅ N/A | Sin lógica de negocio |
| III. Validación / exception filter | ✅ | Sin cambios; el filtro no participa |
| IV. Autenticación / secretos | ✅ | `/metrics` es `@Public()` como `/health` (decisión explícita de la spec); las etiquetas no llevan ids ni datos de requests |
| V / VI. Auditoría / transacciones | ✅ N/A | Sólo lectura |
| VII. Observabilidad | ✅ **cumple** | Con esta feature quedan las cuatro exigencias: logs (028), Correlation ID (028), health (027) y **métricas de latencia y de tasa de error** |
| VIII. Swagger | ✅ planificado | `GET /metrics` documentado con `@ApiTags`/`@ApiOperation`/`@ApiResponse` y `text/plain` |
| IX. Testing | ✅ | Unit + e2e con casos felices y borde (401/404/400/5xx, cardinalidad, stream, coincidencia con el log). Ningún test existente se modifica: las pruebas del hook van en archivos nuevos |
| X. Definición de terminado | ✅ planificado | Tests verdes, `nest build`, Swagger y Postman con el endpoint nuevo |
| XI. Idioma | ✅ | Identificadores en inglés; mensajes y docs en español |
| XII. Spec-first | ✅ | `spec.md` previo; decisión middleware-vs-interceptor documentada |
| XIII. Performance | ✅ parcial, a propósito | **Cumple la parte de SLA verificable** (decorator + test contra el router + métricas con límites en cada umbral). La **caché** y los **índices medidos** del mismo principio son otras features y no se tocan acá |

**Post-design (re-evaluado tras Fase 1)**: sin violaciones. Un solo riesgo conocido, documentado abajo: el registro de métricas vive dentro de los callbacks de `pino-http`, así que depende de que `customLogLevel` nunca devuelva `silent`.

## Project Structure

### Documentation (this feature)

```text
specs/029-http-metrics-sla/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── metrics-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── package.json                                      # + prom-client
├── src/
│   ├── app.module.ts                                 # + MetricsModule
│   ├── modules/metrics/
│   │   ├── metrics.constants.ts                      # REQUEST_METRICS_RECORDER (token)
│   │   └── metrics.module.ts                         # MetricsService + controller + token useExisting
│   ├── services/metrics/
│   │   ├── metrics.service.ts / .spec.ts             # Registry propio, Histogram + Counter, record(), render()
│   ├── controllers/metrics/
│   │   └── metrics.controller.ts / .spec.ts          # GET /metrics, @Public(), Swagger, @Sla('technical')
│   ├── shared/metrics/
│   │   ├── request-metrics.ts / .spec.ts             # UNMATCHED_ROUTE, normalizeMethod, resolveRouteLabel, isStreamResponse, DURATION_BUCKETS_SECONDS, RequestMetricsRecorder
│   │   └── sla.ts / .spec.ts                         # SLA_CLASSES, @Sla(), resolveSla(), umbrales
│   ├── shared/logging/
│   │   ├── request-log-options.ts                    # + parámetro recorder; llama al recorder en customSuccess/ErrorObject
│   │   └── configure-request-logging.ts              # inyecta el recorder (app.get con el token)
│   └── controllers/**/*.controller.ts                # + @Sla('<clase>') en cada handler (14 controllers + app.controller.ts)
└── test/
    ├── metrics.e2e-spec.ts                           # series, 401/404/400/5xx, cardinalidad, stream, == log
    └── sla-coverage.e2e-spec.ts                      # SLA ⇔ rutas reales del router, umbrales ⊂ límites
docs/postman/desapp.postman_collection.json           # request GET /metrics
```

**Structure Decision**: capas del backend como en 027/028. La lógica pura (etiquetas, buckets, SLA) va en `shared/metrics/` para testearla sin Nest; el `Registry` y las métricas viven en un service; el hook de la 028 sólo conoce una interfaz.

## Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Las métricas se registran dentro de `customSuccessObject`/`customErrorObject`: si alguien hiciera que `customLogLevel` devuelva `silent` para una ruta (por ejemplo para callar el ruido de `/metrics`), `pino-http` corta antes y esa ruta dejaría de medirse | Test unitario que fija que `customLogLevel` nunca devuelve `silent`; comentario en el código; test e2e con el nivel de log por defecto de los tests (`silent` del logger) para probar que la medición no depende del nivel |
| La duración de `pino-http` es un entero en milisegundos (`Date.now()`), así que una request de menos de 1 ms se mide como 0 s | Aceptado: se usa el mismo valor del log a propósito (FR-005) y el menor umbral de SLA es 100 ms; el intervalo más bajo (5 ms) la absorbe |
| `/metrics` consultado cada pocos segundos agrega una línea de log por consulta (la 028 loguea todo) | Aceptado y documentado en la spec; reducir ese ruido es otra decisión |

## Complexity Tracking

Sin violaciones de la constitución. Desvíos respecto del plan del equipo, ya listados en el resumen (hook real de la 028, `Registry` propio, decorator en lugar de comentario).
