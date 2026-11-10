# Implementation Plan: Logging estructurado y trazabilidad de requests

**Branch**: `028-structured-request-logging` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-structured-request-logging/spec.md` + plan técnico aportado por el equipo (`nestjs-pino`/`pino-http`, middleware en vez de interceptor), verificado contra el código y con un spike ejecutable (ver [research.md](research.md)).

## Summary

Reemplazar el logging en texto plano por logs JSON estructurados con `nestjs-pino` + `pino-http`.
Una entrada por request (también 401, 404 y 400 de cuerpo inválido) con usuario (o `"anónimo"`),
método, URL con secretos redactados, query y parámetros de ruta, cuerpo redactado y acotado, status y
`responseTime`. Cada request lleva un Correlation ID —el de `X-Correlation-Id` si es válido, un UUID
si no— presente en todos sus logs y devuelto en el header de la respuesta.

La decisión central del equipo se **confirma**: no se hace un interceptor; el middleware es la única capa
que ve el 100% del tráfico. El spike lo verificó (401 y 404 quedan logueados y con header). El plan
incorpora **ocho ajustes** que salieron de contrastarlo con el código y la spec:

1. **Registrar `pino-http` temprano, antes del body parser.** Con sólo `LoggerModule.forRoot`, un JSON mal formado (400) lo rechaza `body-parser` antes de que corra el middleware de Nest: la request no se loguea y la respuesta no lleva `X-Correlation-Id` (verificado en el spike). Se resuelve con un `app.use(pinoHttp(...))` previo al `init`, centralizado en `configureRequestLogging(app)`, que llaman `main.ts` y `test/test-app.ts`. `LoggerModule` queda con `autoLogging: false`: aporta el `Logger` de Nest y el contexto por request, no duplica la línea de cierre.
2. **`req.user.userId`, no `req.user.id`.** Los guards (`JwtAuthGuard`, `SseJwtAuthGuard`, `AdminAccessGuard`) adjuntan `{ userId }`. Con `.id` el usuario saldría siempre `null`.
3. **`"anónimo"`, no `null`** (FR-004 de la spec).
4. **Sin `customProps` para usuario y cuerpo.** `pino-http` evalúa `customProps` al inicio y al cierre y, si el valor cambió (usuario `null` → real), emite las claves duplicadas en el mismo JSON (observado). Usuario, cuerpo y query van en `customSuccessObject`/`customErrorObject`, que corren una sola vez, al cierre.
5. **Serializador propio de `req`.** El de `pino-std-serializers` vuelca todos los headers, incluidos `authorization` y `x-api-key`, y la URL con el `?token=` del stream de notificaciones (observado). El serializador propio emite sólo método y URL redactada.
6. **Redacción por función recursiva, no por `redact` de pino.** `redact` necesita rutas exactas, no distingue mayúsculas y no baja a cualquier profundidad (FR-011 lo exige). Además la lista de campos "conocida por los DTOs" no incluye `email` ni los headers. Se usa un sanitizador que redacta por nombre de clave, sin importar mayúsculas ni anidamiento (`pass|token|secret|api.?key|authorization|credential|email`), para el cuerpo, la query y la URL.
7. **El header de respuesta se fija dentro de `genReqId`** (`res.setHeader`), sin middleware aparte, y `genReqId` **valida** el valor entrante (FR-007: longitud y charset) antes de reutilizarlo.
8. **CORS ya está parametrizado** (`cf5ae03`, `CORS_ORIGIN` + `parseCorsOrigins`): la precondición del plan era obsoleta. Sólo falta `exposedHeaders: ['X-Correlation-Id']`.

Además: `LOG_LEVEL` opcional con default por entorno (`debug` si `NODE_ENV=development`, que es lo que trae `.env.example`; `silent` bajo `NODE_ENV=test`; `info` en cualquier otro caso); `pino-pretty` queda sólo como script opcional `dev:pretty` (pipe), no como transporte, para no romper FR-005 (siempre JSON).

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict`), Node.js 20, NestJS 11.2 (`@nestjs/core` 11.2.3 instalado)

**Primary Dependencies**: `nestjs-pino@^5.3.1` (peers: `pino@^10`, `pino-http@^11`, `rxjs`, `@nestjs/*@^11.0.8`), `pino-http@^11`, `pino@^10`; dev: `pino-pretty`

**Storage**: N/A (los logs salen por stdout; sin tablas ni migraciones)

**Testing**: Jest unit (helpers puros) y Jest + supertest e2e sobre `createTestApp()` con PostgreSQL efímero de Testcontainers, capturando los logs en memoria

**Target Platform**: Servicio HTTP Linux/Docker; los logs los recolecta la infraestructura

**Project Type**: web-service (monorepo; sólo se toca `backend/`)

**Performance Goals**: < 5 ms de sobrecosto por request (SC-007); pino escribe en forma asíncrona/barata

**Constraints**: toda salida de log en JSON (FR-005); cero secretos, email ni nombre de usuario en logs (FR-011); cuerpo de request acotado (FR-014); un fallo de logging no cambia la respuesta (FR-015); sin propagación a APIs externas ni listeners asíncronos (FR-016)

**Scale/Scope**: ~6 archivos de producción nuevos, 3 editados (`main.ts`, `app.module.ts`, `test/test-app.ts`), 1 dependencia runtime nueva más dos peers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Capas | ✅ | Sin controller/service nuevos: la infraestructura de logging vive en `shared/observability/logging/` y `modules/observability/`, como el filtro global en `shared/filters/`. El test tsarch no se ve afectado (no hay imports entre capas nuevos) |
| II. Dominio rico | ✅ N/A | Sin lógica de negocio |
| III. Validación / exception filter | ✅ | El formato de error del filtro no cambia; sus logs pasan a ser JSON con el Correlation ID, y deja de loguear los 4xx (ya los registra el log de requests): sólo loguea los 5xx, con el stack real |
| IV. Autenticación / secretos | ✅ **refuerza** | Ningún JWT, contraseña, API key, email ni nombre de usuario en logs, en ninguna capa: redacción recursiva + headers fuera + URL saneada |
| V / VI. Auditoría / transacciones | ✅ N/A | El log de requests no es el log de auditoría de compra/venta |
| VII. Observabilidad | ✅ **cumple** | Logs estructurados + Correlation ID propagado por middleware en toda la cadena de la request. Quedan para otras features el endpoint de health (027, hecho) y las métricas |
| VIII. Swagger | ✅ | Sin endpoints nuevos; el header `X-Correlation-Id` se documenta en la descripción global del documento OpenAPI |
| IX. Testing | ✅ | Unit de helpers + e2e con casos felices y borde (401/404/400, id entrante válido/inválido, concurrencia, redacción). Ningún test existente se modifica ni se borra |
| X. Definición de terminado | ✅ planificado | Tests verdes, `nest build`, Swagger (descripción) y Postman (descripción + test a nivel colección) |
| XI. Idioma | ✅ | Identificadores en inglés; mensajes/docs en español |
| XII. Spec-first | ✅ | `spec.md` previo; la decisión del Correlation ID entrante está documentada ahí |

**Post-design (re-evaluado tras Fase 1)**: sin violaciones nuevas. Dos desvíos respecto del pedido original, ambos justificados abajo.

## Project Structure

### Documentation (this feature)

```text
specs/028-structured-request-logging/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── request-logging.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── package.json                                   # + nestjs-pino, pino-http, pino; dev: pino-pretty; script dev:pretty
├── .env.example                                   # + LOG_LEVEL (opcional)
├── src/
│   ├── main.ts                                    # bufferLogs, useLogger, configureRequestLogging, exposedHeaders, nota Swagger
│   ├── app.module.ts                              # + LoggingModule
│   ├── modules/observability/
│   │   ├── logging.constants.ts                   # LOG_CONFIG (token overridable en tests)
│   │   └── logging.module.ts                      # LoggerModule.forRootAsync(autoLogging:false) + provider LOG_CONFIG
│   └── shared/observability/logging/
│       ├── correlation-id.ts / .spec.ts           # resolveCorrelationId()
│       ├── redaction.ts / .spec.ts                # redactBody(), redactQuery(), redactUrl()
│       ├── request-log-options.ts / .spec.ts      # buildRequestLogOptions(): pino-http (genReqId, serializers, custom*Object, customLogLevel)
│       └── configure-request-logging.ts           # app.use(pino-http) previo al body parser
│   └── shared/cors-origins.ts                     # + createCorsOptions() con exposedHeaders (+ spec)
└── test/
    ├── test-app.ts                                # + configureRequestLogging(app) (no cambia su API)
    └── request-logging.e2e-spec.ts                # headers, campos, redacción, concurrencia, FR-008
docs/postman/desapp.postman_collection.json        # descripción + test a nivel colección del header
```

**Structure Decision**: la lógica pura (id, redacción, opciones de `pino-http`) va en `shared/observability/logging/` para testearla sin Nest ni red; el cableado de DI va en `modules/observability/`; el cableado Express previo al body parser va en `configureRequestLogging`. No hay carpetas de `controllers/services/domain/repositories`: no hay lógica de negocio ni acceso a datos.

## Complexity Tracking

| Desvío | Why Needed | Simpler Alternative Rejected Because |
|--------|------------|-------------------------------------|
| Middleware en lugar del "interceptor global" del pedido original | Un interceptor no corre si un guard rechaza (401/403) ni en rutas inexistentes (404); FR-001 exige loguear todo | Interceptor: deja huecos justo en los casos de mayor interés para diagnóstico. El spec describe el comportamiento, no la técnica |
| `pino-http` registrado dos veces: `app.use` temprano (loguea) + `LoggerModule` con `autoLogging: false` (contexto/`Logger` de Nest) | El `app.use` previo al body parser es la única forma de loguear los 400 por JSON inválido y devolverles el header; `LoggerModule` es lo que enlaza el `Logger` de Nest al contexto de la request (FR-008) | Sólo `LoggerModule`: no cubre el 400 de cuerpo inválido (verificado). Sólo `app.use`: los `Logger` de los servicios y del filtro no llevarían el Correlation ID |
