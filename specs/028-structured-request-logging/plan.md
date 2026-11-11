# Implementation Plan: Logging estructurado y trazabilidad de requests

**Branch**: `028-structured-request-logging` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-structured-request-logging/spec.md` + plan técnico aportado por el equipo (`nestjs-pino`/`pino-http`, middleware en vez de interceptor para el logging técnico; Interceptor de AOP sólo para la auditoría de negocio de la User Story 5), verificado contra el código y con un spike ejecutable (ver [research.md](research.md)).

## Summary

Reemplazar el logging en texto plano por logs JSON estructurados con `nestjs-pino` + `pino-http`.
Una entrada por request (también 401, 404 y 400 de cuerpo inválido) con usuario (o `"anónimo"`),
método, URL con secretos redactados, query y parámetros de ruta, cuerpo redactado y acotado, status y
`responseTime`. Cada request lleva un Correlation ID —el de `X-Correlation-Id` si es válido, un UUID
si no— presente en todos sus logs y devuelto en el header de la respuesta.

La decisión central del equipo se **confirma** para el logging técnico: no se hace con un interceptor; el middleware es la única capa
que ve el 100% del tráfico. (La auditoría de negocio de la User Story 5 sí usa un Interceptor, con otro propósito: ver "Segunda capa" más abajo.) El spike lo verificó (401 y 404 quedan logueados y con header). El plan
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

## Segunda capa: auditoría de negocio con AOP (User Story 5, FR-018 a FR-025)

La spec se actualizó con una segunda capa, **adicional** al logging técnico: un Interceptor de NestJS que registra qué operación de negocio se ejecutó, quién y con qué resultado. El plan original no la contemplaba; esta sección es el delta y no cambia nada de lo anterior. La decisión "middleware, no interceptor" sigue vigente **para el logging técnico**: el Interceptor no ve el 100% del tráfico y por eso no puede reemplazarlo (ver [research.md](research.md) §15).

Verificado contra el código: hoy no existe ningún Interceptor en `backend/src`, pero el patrón de metadatos por handler ya se usa (`@Public()`, `@Sla()`), y el `Logger` de Nest ya lleva el Correlation ID por el contexto de la request (research §6).

**Diseño**

1. **Declaración por metadatos.** `@AuditedOperation(operation, { actor })` sobre cada handler que es una operación de negocio, igual que `@Sla`. `operation` es un código fijo (`ALERT_CREATED`) o una función `(req) => código`, para que un mismo `POST /orders` dé `TOKENS_BOUGHT` o `TOKENS_SOLD` según `body.side` (FR-020). Un handler sin el decorator pasa de largo.
2. **Interceptor global.** `BusinessAuditInterceptor` se registra como `APP_INTERCEPTOR`. Con metadatos hace `next.handle().pipe(tap({ next, error }))`: registra al terminar y **siempre relanza** el error (no lo traga). El registro va dentro de un `try/catch`: un fallo de logging no altera la respuesta (FR-025).
3. **Registro.** `Logger('BusinessAudit')` de Nest → `nestjs-pino`: el Correlation ID se agrega solo (FR-023), sin pasárselo. Campos: `event: "business_audit"`, `operation`, `actor`, `outcome` (`success` | `failure`) y `failureCategory` (`rejected` | `unexpected`). **No** repite método, ruta, parámetros, cuerpo, status ni duración (FR-018) ni lleva stack ni mensaje interno (FR-021). Nivel: `info` éxito, `warn` rechazo, `error` inesperado.
4. **Actor (FR-022).** `req.user.userId` si existe. Si no existe y la operación se declara `actor: 'system'` (los endpoints con `AdminApiKeyGuard`, que **no** adjuntan usuario), `"sistema"`; si se declara `actor: 'anonymous'` (alta y login), `"anónimo"`. Nunca el valor de la API key.
5. **Clasificación de fallos.** `DomainError` o `HttpException` con status < 500 → `rejected` (rechazo por regla de negocio); cualquier otra cosa → `unexpected`. Función pura, probada sin Nest.
6. **Hallazgo: los pipes corren después de los interceptores.** El orden de Nest es middleware → guards → interceptores → pipes → handler. Un guard (401/403), una ruta inexistente (404) y un JSON ilegible (body-parser) **no** atraviesan el Interceptor, como pide FR-024. Pero un cuerpo que no pasa la validación del DTO sí lo atraviesa, porque `ValidationPipe` falla *dentro* de `next.handle()`. FR-024 incluye el "cuerpo inválido" entre lo que no se audita, y esa operación tampoco llegó a ejecutarse. Se resuelve con `RequestValidationException extends BadRequestException`, lanzada por el `exceptionFactory` de `createGlobalValidationPipe`; el Interceptor la ignora. El status, el mensaje y el formato del error no cambian (sigue siendo un `BadRequestException`).
7. **Ubicación.** `shared/observability/business-audit/` (decorator, interceptor, clasificador y actor, con sus specs) y `modules/observability/business-audit.module.ts` (provee `APP_INTERCEPTOR`), importado por `ObservabilityModule`. Mismo criterio que el filtro global en `shared/filters/`: infraestructura transversal, sin `controllers/services/domain/repositories` nuevos.
8. **Cobertura verificable.** Un e2e `business-audit-coverage` (mismo patrón que `sla-coverage`, reutilizando `route-inventory`) falla si un handler `POST`/`PATCH`/`DELETE` no declara `@AuditedOperation`: un endpoint de escritura nuevo no puede quedar sin auditar por olvido.

**Catálogo propuesto de operaciones** (FR-020 lo deja para la planificación; a confirmar). Se auditan todas las escrituras; las lecturas y el stream de notificaciones no.

| Endpoint | Operación | Actor |
|----------|-----------|-------|
| `POST /orders` | `TOKENS_BOUGHT` / `TOKENS_SOLD` (según `side`) | usuario |
| `DELETE /orders/:id` | `ORDER_CANCELLED` | usuario |
| `POST /alerts` | `ALERT_CREATED` | usuario |
| `DELETE /alerts/:id` | `ALERT_DELETED` | usuario |
| `PATCH /notifications/:id/read` | `NOTIFICATION_READ` | usuario |
| `PATCH /notifications/read-all` | `NOTIFICATIONS_ALL_READ` | usuario |
| `PATCH /users/me/strategies/:id/select` | `STRATEGY_SELECTED` | usuario |
| `PATCH /users/me/strategies/:id/weights` | `STRATEGY_WEIGHTS_UPDATED` | usuario |
| `PATCH /users/me/strategies/:id/position-weights/:position` | `STRATEGY_POSITION_WEIGHTS_UPDATED` | usuario |
| `POST /auth/register` | `USER_REGISTERED` | anónimo |
| `POST /auth/login` | `USER_LOGGED_IN` (un fallo de credenciales queda como `rejected`) | anónimo |
| `POST /auth/api-key` | `API_KEY_ISSUED` | usuario |
| `POST /quotes/recalculate` | `QUOTES_RECALCULATED` | sistema |
| `POST /sync/whoscored` | `PLAYER_SYNC_TRIGGERED` | sistema |
| `POST /sync/football-data` | `FOOTBALL_DATA_SYNC_TRIGGERED` | sistema |
| `POST /admin/simulate-market` | `MARKET_SIMULATED` | usuario (admin) |

**Ajustes sobre lo que se podría asumir**

9. **No se usa `pino-http` ni un mapa ruta→nombre para esto.** El middleware no conoce el resultado de negocio ni distingue un rechazo de dominio de un error inesperado, y un mapa aparte duplicaría las rutas y se desincronizaría. El decorator queda junto al handler.
10. **No hay que tocar los services.** Ni el controller ni el service invocan el registro (FR-019); el único cambio en código existente es el decorator en 16 handlers de 10 controllers (aditivo, como `@Sla`) y una subclase en `createGlobalValidationPipe`.
11. **El `@Cron` queda sin cubrir**, como dice la spec: el Interceptor está atado al contexto HTTP. Cubrirlo requeriría un decorator de método sobre el service, otro mecanismo, fuera de esta entrega.
12. **Ningún test existente se modifica**: `global-validation-pipe.spec` sigue pasando porque `RequestValidationException` es un `BadRequestException`. Los tests nuevos van en archivos nuevos.

**Pruebas**: unit del interceptor (éxito; `DomainError` → `rejected`; error inesperado → `unexpected`; `RequestValidationException` ignorada; handler sin metadatos; el error se relanza; un logger que lanza no altera el resultado; operación por función `side`), del clasificador y del actor; e2e (compra y venta con nombre semántico, fallo por tenencia insuficiente → `rejected`, 401/404/JSON ilegible/validación de DTO sin registro, lectura sin registro, operación de sistema con actor `"sistema"`, mismo Correlation ID que la línea técnica, ningún campo técnico repetido ni secretos) y `business-audit-coverage`.

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

**Re-evaluación con la User Story 5 (auditoría de negocio con AOP)**: sin violaciones. I: el Interceptor es infraestructura transversal en `shared/observability/` (como `AllExceptionsFilter`); no contiene lógica de negocio, sólo rotula y clasifica, y los controllers siguen hablando sólo con services. IV: el actor es el identificador interno, nunca una API key, un token ni datos personales; rige la redacción existente. V: no es el log de auditoría append-only de compra/venta (aquel sigue siendo el `TokenTransaction`), y la spec lo aclara. VII: refuerza la observabilidad con el significado de negocio. IX: unit + e2e + test de cobertura, sin modificar ningún test existente. VIII/X: sin endpoints nuevos ni cambios de contrato, así que Swagger y Postman no cambian. XII: la spec se actualizó antes de planificar.

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
│   ├── modules/observability/business-audit.module.ts   # US5: APP_INTERCEPTOR (importado por ObservabilityModule)
│   └── shared/observability/business-audit/             # US5: auditoría de negocio con AOP
│       ├── audited-operation.decorator.ts / .spec.ts    # @AuditedOperation(operation, { actor }) + lectura de metadatos
│       ├── business-audit.interceptor.ts / .spec.ts     # tap(next/error), relanza, try/catch del registro
│       ├── audit-outcome.ts / .spec.ts                  # classifyFailure(): rejected | unexpected; resolveActor()
│       └── request-validation.exception.ts              # RequestValidationException extends BadRequestException
│   └── shared/validation/global-validation-pipe.ts      # US5: el exceptionFactory lanza RequestValidationException
│   └── controllers/**/*.controller.ts                   # US5: @AuditedOperation en 16 handlers de 10 controllers (aditivo)
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
| Interceptor de AOP **además** del middleware (User Story 5) | La auditoría de negocio necesita el significado de la operación y su resultado, que sólo existen cuando un controller efectivamente se ejecuta; un Interceptor lo declara una vez junto al handler y lo envuelve sin tocar los services (FR-019). No contradice el primer desvío: el middleware sigue siendo la única capa de cobertura universal | Ampliar el middleware con un mapa ruta→operación: no conoce el resultado de negocio ni distingue rechazo de error inesperado, y duplicaría las rutas. Loguear dentro de cada service: repetido y fácil de olvidar |
