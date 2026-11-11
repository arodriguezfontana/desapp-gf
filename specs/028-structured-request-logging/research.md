# Research: Logging estructurado y trazabilidad de requests

Verificación del plan del equipo contra el código del repo, el código fuente de `pino-http@11` / `nestjs-pino@5.3.1`
y un **spike ejecutable** (app Nest 11 mínima con guard global, `POST /auth/login`, `POST /echo`, `GET /players/:id`,
SSE con token en la URL) que se corrió en un directorio temporal, fuera del repo. No quedó ningún `NEEDS CLARIFICATION`.

## 1. Middleware vs. interceptor (confirmado)

- **Decision**: no construir interceptor. El logging de requests lo hace `pino-http`.
- **Evidencia**: en el spike, con `pino-http` como middleware, una request sin token (401, rechazada por guard) y una ruta inexistente (404) quedaron logueadas, con `userId: "anónimo"` y con el header `X-Correlation-Id` en la respuesta. Un interceptor no habría corrido en ninguno de los dos casos.
- **Rationale**: `FR-001`/`FR-002` piden cobertura total y automática; sólo el middleware la da.
- **Alternatives considered**: interceptor global (huecos, descartado); interceptor + middleware **para el logging técnico** (dos rutas de logging, duplicación). Esto no excluye un Interceptor para un fin distinto: la auditoría de negocio de la User Story 5 (ver §15).
- **Nota**: la spec describe el comportamiento, no la técnica; el "interceptor global" del pedido original queda reemplazado y justificado en `plan.md` → Complexity Tracking.

## 2. Hueco: el 400 por JSON mal formado (nuevo hallazgo)

- **Hallazgo**: Nest registra `body-parser` en `init`, **antes** de los middleware de los módulos. Un `POST` con `{"a":` lo rechaza el parser y nunca llega a `pino-http` registrado vía `LoggerModule`: la request **no se loguea** y la respuesta **no trae** `X-Correlation-Id` (spike: `cid=null`, sin línea de log). Viola FR-001 y FR-009 (la spec lista "cuerpo inválido" entre los casos que deben registrarse).
- **Decision**: registrar `pino-http` con `app.use(...)` **antes** de `init`/`listen` (queda delante del parser). Se centraliza en `configureRequestLogging(app)`, usada por `main.ts` y por `test/test-app.ts`, para que producción y e2e se comporten igual.
- **Evidencia**: con el `app.use` temprano, el spike logueó el 400 con su Correlation ID y devolvió el header. Como `pino-http` completa el log en `finish`/`close`, ya hay `req.body` parseado cuando se arma la entrada (cuando el parser tuvo éxito); si el parser falló, `body` queda ausente.
- **Consecuencia**: `LoggerModule` se configura con `autoLogging: false` para que no emita una segunda línea de cierre. Sigue aportando el `Logger` de Nest y el contexto por request (ver §6).
- **Alternatives considered**: `bodyParser: false` y registrar el parser a mano después de `pino-http` (cambia el arranque de toda la API, más riesgo); aceptar el hueco documentado (viola la spec).

## 3. `customProps` duplica claves → `customSuccessObject`/`customErrorObject`

- **Hallazgo**: `pino-http` llama a `customProps` al inicio y otra vez al cierre; si el resultado cambió (usuario `null` → autenticado), agrega un segundo `child` y el JSON sale con claves repetidas: `"userId":"anónimo",...,"userId":"user-123"`. Observado en el spike.
- **Decision**: usuario, query, params, ruta y cuerpo se agregan con `customSuccessObject` (y `customErrorObject` para 5xx/errores), que se evalúan **una vez**, al cierre, cuando `req.user` ya fue completado por el guard.
- **Rationale**: JSON sin claves duplicadas, y el dato correcto (usuario real, ruta resuelta).

## 4. Identidad del usuario

- **Hallazgo**: los guards setean `request.user = { userId }` (`JwtAuthGuard`, `SseJwtAuthGuard`, `AdminAccessGuard` tanto por API key como por JWT). El plan decía `req.user?.id`.
- **Decision**: `userId = req.user?.userId ?? 'anónimo'` (campo `userId`).
- **Rationale**: con `.id` el log registraría `null` siempre. Además la spec define `"anónimo"` (FR-004), no `null`. Cuando el guard no corrió o rechazó, `req.user` no existe → `"anónimo"`, esperado.

## 5. Qué se serializa de la request (seguridad)

- **Hallazgo**: el serializador por defecto de `pino-http` incluye **todos** los headers (spike: `"authorization":"Bearer JWT-SECRET"`, `"x-api-key":"KEY-SECRET"`) y la URL completa con `?token=...`.
- **Decision**: serializador de `req` propio que emite sólo `{ method, url }` con la URL redactada, y serializador de `res` que emite sólo `{ statusCode }` (FR-013: ni cuerpo ni headers de respuesta). Query y params van como campos propios ya redactados. No se loguea ningún header de la request.
- **Rationale**: Principio IV (nada de JWT/credenciales en logs). El stream de notificaciones (`GET /notifications/stream?token=<JWT>`) es el caso real que motivó el recorte de query string en `AllExceptionsFilter`.
- **Datos útiles que sí se pueden emitir**: método, ruta registrada (`req.route.path`, p. ej. `/players/:id`), `params` (`{ id: ... }`) y `query`, disponibles al cierre (spike).

## 6. Correlation ID en todos los logs (FR-008)

- **Hallazgo**: con `useLogger(app.get(Logger))` y `LoggerModule`, los `new Logger('X').log(...)` de servicios y filtros dentro de una request salen con el `reqId` de la request, vía el almacenamiento de contexto asíncrono de `nestjs-pino` (spike: `"reqId":"mi-id-123","context":"Svc","msg":"dentro del handler echo"`). Alcanza a `AllExceptionsFilter` sin tocarlo.
- **Decision**: `quietReqLogger: true` para que el child por request lleve sólo el identificador (si no, cada log del handler repetiría el objeto `req` entero). Clave del id: `reqId` por defecto de `pino-http`; se renombra con `customAttributeKeys: { reqId: 'correlationId' }` para que el campo se llame igual que el header.
- **Aislamiento (FR-010)**: el contexto es por request (almacenamiento asíncrono), no global; el e2e lo verifica con dos requests concurrentes.
- **Límite aceptado (spec)**: listeners de eventos y llamadas a APIs externas fuera del ciclo de la request no tienen este contexto.

## 7. `genReqId`: reutilizar con validación, y el header

- **Decision**: `genReqId(req, res)`: toma `x-correlation-id`; si es un string de 1–64 caracteres que cumple `^[A-Za-z0-9._:-]+$` lo reutiliza, si no genera `randomUUID()`. Antes de devolver, `res.setHeader('X-Correlation-Id', id)`.
- **Rationale**: el header de respuesta se fija en el mismo punto donde se decide el id, antes de cualquier guard o parser posterior, y sin un middleware aparte que haya que ordenar. La validación evita inyección en los logs y valores enormes (FR-007). En el spike, `a b"c` fue descartado y reemplazado por un UUID. El charset excluye espacios, comillas y saltos de línea.
- **Nota**: Node ya rechaza saltos de línea en headers entrantes antes de llegar a la app; la validación igual protege contra valores largos o con caracteres de formato.
- **Alternatives considered**: middleware propio que copia `req.id` al header (plan original): más piezas y orden frágil; sin ventaja.

## 8. Redacción

- **Hallazgo**: `redact` de pino trabaja con rutas fijas (`req.body.password`): no distingue mayúsculas, no baja a profundidad arbitraria y exige enumerar cada ruta; la lista de campos "tipados en los DTOs" no incluye `email` ni headers.
- **Decision**: función recursiva `redactBody(value)` que reemplaza por `[REDACTED]` el valor de toda clave que coincida con `/pass|token|secret|api.?key|authorization|credential|email|user.?name/i`, a cualquier profundidad (objetos y arreglos), con tope de profundidad. La misma regla se aplica a `req.query` y a los parámetros de la URL (`redactUrl`). Se redactan también valores primitivos en arreglos de pares si coinciden (no aplica a este API).
- **Rationale**: FR-011/FR-012. Cubre `password`, `accessToken`, `refreshToken`, `apiKey`, `x-api-key`, `Authorization`, `token` en query, `email` y `username` (Principio IV; el `userId` interno no se redacta: es un UUID, no un dato personal). Falsos positivos posibles (`tokens` de dominio): hoy el dominio no tiene campos con esos nombres; el costo de un falso positivo es perder un dato en el log, aceptable frente a filtrar un secreto.
- **Cuerpos**: se redacta una **copia**; la request original nunca se muta.

## 9. Límite de tamaño del cuerpo (FR-014)

- **Decision**: tras redactar, si `JSON.stringify(body)` supera 2048 caracteres, se registra `{ _truncated: true, preview: <primeros 2048 caracteres> }`. Si el cuerpo no es serializable, `{ _unserializable: true }`. Cualquier excepción del armado del log se atrapa (FR-015).
- **Rationale**: acota el volumen de logs ante cuerpos grandes (p. ej. simulación o sincronizaciones). 2048 se puede ajustar en una constante.

## 10. Niveles y configuración

- **Decision**: `customLogLevel`: 5xx o error → `error`; 4xx → `warn`; resto → `info`. `LOG_LEVEL` (opcional) con default por entorno: `debug` si `NODE_ENV=development` (valor que trae `backend/.env.example`), `silent` si `NODE_ENV=test` (no inundar la suite), `info` en cualquier otro caso (incluido `production`). Un `LOG_LEVEL` inválido cae al default del entorno.
- **Rationale**: respeta el pedido del equipo (`info` por defecto, `debug` en desarrollo). Las líneas de cierre de request salen en `info`/`warn`/`error`, así que `debug` sólo agrega los `Logger.debug` de Nest.
- **`pino-pretty`**: sólo devDependency y un script `dev:pretty` (`nest start --watch | pino-pretty`). No se configura como `transport` en la app: la salida del backend es siempre JSON (FR-005).

## 11. Logs de arranque y de tareas programadas

- **Decision**: `NestFactory.create(AppModule, { bufferLogs: true })` + `app.useLogger(app.get(Logger))`. Los logs de arranque (rutas mapeadas, seeds) y de los cron salen en JSON sin Correlation ID (no nacen de una request).
- **Rationale**: `bufferLogs` evita que los logs previos a `useLogger` salgan en texto plano.

## 12. Estrategia de pruebas

- **Unit** (`shared/observability/logging/*.spec.ts`): `resolveCorrelationId` (válido, vacío, largo, caracteres inválidos, array de headers), `redactBody` (anidado, mayúsculas, arreglos, no muta, tope de profundidad), `redactUrl` (token en query), `buildRequestLogOptions` (serializers, niveles, `customSuccessObject` con `"anónimo"`/`userId`, truncado), `createCorsOptions` (`exposedHeaders`).
- **E2E** (`test/observability/request-logging.e2e-spec.ts`, sobre `createTestApp()`; el sumidero de logs se inyecta sobrescribiendo el provider `LOG_CONFIG`, igual que `sync-trigger` sobrescribe adaptadores):
  - header `X-Correlation-Id` presente en 200, 401 (login fallido), 404 y 400 por JSON mal formado;
  - id entrante válido: misma salida; inválido: reemplazado por UUID;
  - cada una de esas requests deja una entrada con los campos de FR-003;
  - dos requests concurrentes: filtrando por cada id aparecen sólo sus entradas (FR-010);
  - un log emitido por un servicio/filtro dentro de la request lleva su `correlationId` (un 5xx forzado dispara el `error` de `AllExceptionsFilter`, con el stack real) — FR-008;
  - registro + login + emisión de API key + stream de notificaciones: ni la contraseña, ni el email, ni el nombre de usuario, ni el JWT, ni la API key aparecen en ninguna línea capturada;
  - la respuesta del login (que lleva el JWT) no aparece: no se loguea el cuerpo de respuesta.
- **Arquitectura**: el test tsarch existente no requiere cambios.
- **No tocar**: ningún test existente. `createTestApp` gana una llamada a `configureRequestLogging(app)` pero conserva su firma.
- **Ruido**: bajo `NODE_ENV=test` el nivel es `silent`; el e2e de logging sobrescribe `LOG_CONFIG` con nivel `info` y un sumidero en memoria.

## 13. CORS y documentación

- **Hallazgo**: `main.ts` ya usa `parseCorsOrigins(process.env.CORS_ORIGIN)` (commit `cf5ae03`); la "deuda" del plan original ya estaba pagada.
- **Decision**: agregar `exposedHeaders: ['X-Correlation-Id']` mediante `createCorsOptions()` en `shared/cors-origins.ts` (testeable sin levantar la app) y usarlo desde `main.ts`. Sin esto el navegador oculta el header a `fetch`.
- **Swagger**: no hay endpoints nuevos. El header se documenta en la descripción global del `DocumentBuilder` ("toda respuesta incluye `X-Correlation-Id`…"). **Postman**: nota en la descripción de la colección y un test a nivel colección que verifica la presencia del header.

## 14. Fuera de alcance / riesgos conocidos

- Sin propagación del id a listeners de eventos (`quote.recalculated` → alertas → notificaciones) ni a Football-Data/WhoScored (spec).
- **Líneas duplicadas (resuelto)**: `AllExceptionsFilter` ya no loguea los 4xx —los registra el log de requests con status, usuario y Correlation ID—; sólo loguea los 5xx, porque trae el stack real del error. Además la línea de cierre de un 5xx descarta el `Error` fabricado por `pino-http` ("failed with status code 500", con un stack que no es el del fallo). Un 4xx deja una línea; un 5xx deja dos, con información distinta.
- Las conexiones de larga duración (SSE) registran al cerrarse; si el cliente corta, `pino-http` emite "request aborted".
- Las métricas (ítem #3) reutilizarán `responseTime`; no se implementan acá.
- La auditoría de negocio por AOP (§15) no cubre las operaciones disparadas sin endpoint (el recálculo semanal con `@Cron`): quedan fuera de esta entrega, como dice la spec.

## 15. Auditoría de negocio con AOP (User Story 5)

- **Decision**: un Interceptor global (`BusinessAuditInterceptor`, `APP_INTERCEPTOR`) que lee metadatos `@AuditedOperation` del handler y registra operación, actor y resultado con el `Logger` de Nest. El middleware de §1 se mantiene sin cambios para el logging técnico.
- **Por qué los dos conviven**: un Interceptor sólo envuelve un método que se ejecuta; el middleware es el único que ve el 100% del tráfico (§1). Son capas distintas: el middleware registra *que llegó una request*; el Interceptor registra *qué operación de negocio ejecutó*. No hay duplicación porque la auditoría no repite ningún campo técnico (FR-018).
- **Orden de ejecución de Nest (hallazgo)**: middleware → guards → interceptores → pipes → handler → interceptores. Consecuencias: (a) 401/403, 404 y el JSON ilegible del body-parser nunca llegan al Interceptor (FR-024 se cumple por construcción); (b) la validación de DTO (`ValidationPipe`) falla *dentro* de `next.handle()`, así que el Interceptor sí la vería como un error del handler.
- **Cómo se excluye la validación de DTO**: `createGlobalValidationPipe` hoy lanza un `BadRequestException` común, indistinguible de uno lanzado por un service. Se cambia el `exceptionFactory` para que lance `RequestValidationException extends BadRequestException` (mismo status, mismo mensaje traducido, mismo formato de error: el `AllExceptionsFilter` y el spec de la pipe no notan la diferencia) y el Interceptor la ignora.
- **Actor**: los guards de API key (`ApiKeyGuard`, `AdminApiKeyGuard`) sólo validan y **no** adjuntan usuario ni la key a la request (verificado); el JWT adjunta `{ userId }`. Por eso el actor sale de `req.user` y, si no hay, de la declaración (`'system'` o `'anonymous'`). Nunca se toca el valor de la API key.
- **Resultado**: `DomainError` o `HttpException` < 500 → `rejected`; el resto → `unexpected`. El Interceptor relanza siempre; el `AllExceptionsFilter` sigue produciendo la respuesta.
- **Correlation ID**: el `Logger` de Nest ya lo recibe por el contexto de la request (§6); no se pasa a mano (FR-023).
- **Verificación de cobertura**: e2e `business-audit-coverage` con el inventario de rutas reales (`route-inventory`): todo `POST`/`PATCH`/`DELETE` debe declarar `@AuditedOperation`; las lecturas no (FR-020).
- **Alternatives considered**: ampliar `pino-http` (no conoce la operación ni el resultado de negocio); `customProps` con un mapa ruta→nombre (duplica rutas y se desincroniza); logging manual en cada service (repetido, olvidable, ensucia los services); un decorator sobre el service (otro mecanismo, cubriría el `@Cron`, pero queda fuera de esta entrega).
- **Fuera de alcance**: las operaciones disparadas sin endpoint (el recálculo semanal con `@Cron`) no pasan por un controller y el Interceptor no las ve; ver spec.
