---

description: "Task list for Logging estructurado y trazabilidad de requests"

---

# Tasks: Logging estructurado y trazabilidad de requests

**Input**: Design documents from `specs/028-structured-request-logging/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/request-logging.md](./contracts/request-logging.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios — el Principio IX de la constitución exige casos felices y borde, unit tests y e2e con supertest sobre PostgreSQL efímero de Testcontainers. El test de arquitectura tsarch existente (`backend/test/architecture.spec.ts`) cubre las capas sin cambios. **Ningún test existente se modifica ni se borra**: las ampliaciones van en archivos nuevos.

**Organization**: Tareas agrupadas por user story de `spec.md` (US1–US3 son P1; US4 y US5 son P2). El código de producción es una sola tubería de logging: nace en US1 (Correlation ID + wiring), US2 le suma los campos de cada entrada, US3 prueba y cierra la redacción de secretos y US4 agrega la reutilización validada del id entrante. Los helpers puros que bloquean a todas las historias (nivel de log y redacción) están en Foundational.

**⚠️ Antes de cualquier tarea que corra e2e o integración** (T018, T034, T036, T041, T042, T058, T060, T061): ejecutar `docker info`. Si Docker está apagado, el setup de tests cae en silencio a la base de desarrollo y los e2e **borran datos** (ya pasó). Si está apagado, levantar Docker Desktop y esperar a que `docker info` responda.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 (Correlation ID y traza completa), US2 (registro automático con campos), US3 (sin secretos en logs), US4 (reutilizar el id entrante), US5 (auditoría de negocio con AOP)
- Rutas exactas en cada descripción, siguiendo la estructura de `plan.md`
- Todo el trabajo es en `backend/` (más `docs/postman/`); los comandos `pnpm` se corren desde `backend/`

## Path Conventions

Monorepo existente. Backend NestJS: `backend/src/shared/observability/logging/` (helpers puros), `backend/src/modules/observability/` (DI), `backend/test/` (e2e). Esta feature no toca `frontend/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencias y configuración de scripts

- [X] T001 Agregar las dependencias con pnpm desde `backend/`: `pnpm add nestjs-pino@^5.3.1 pino-http@^11 pino@^10` y `pnpm add -D pino-pretty` (actualiza `backend/package.json` y `backend/pnpm-lock.yaml`). Los peers de `nestjs-pino@5.3.1` son `pino@^10`, `pino-http@^11`, `rxjs` y `@nestjs/*@^11.0.8` (el repo tiene Nest 11.2.3). No usar `npm`
- [X] T002 Agregar el script `"dev:pretty": "nest start --watch | pino-pretty"` en `backend/package.json` y documentar la variable opcional `LOG_LEVEL` (valores de pino: `trace|debug|info|warn|error|fatal|silent`; default por entorno) como comentario más una línea `# LOG_LEVEL=info` en `backend/.env.example`, junto a las demás variables

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Helpers puros, configuración inyectable y sumidero de logs para tests, de los que dependen todas las historias

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T003 [P] Crear `backend/src/shared/observability/logging/log-level.spec.ts` (unit, falla hasta T004): `resolveLogLevel(logLevel, nodeEnv)` devuelve `LOG_LEVEL` si es un nivel válido de pino (case-insensitive → minúscula); si no hay `LOG_LEVEL` o es inválido, el default es `debug` con `nodeEnv === 'development'`, `silent` con `'test'` e `info` en cualquier otro caso (incluido `production` y `undefined`)
- [X] T004 Crear `backend/src/shared/observability/logging/log-level.ts` con `resolveLogLevel(logLevel: string | undefined, nodeEnv: string | undefined): string` según T003
- [X] T005 [P] Crear `backend/src/shared/observability/logging/redaction.spec.ts` (unit, falla hasta T006): (a) `redactBody` reemplaza por `[REDACTED]` el valor de las claves que cumplen `/pass|token|secret|api.?key|authorization|credential|email/i` (`password`, `Password`, `accessToken`, `refresh_token`, `apiKey`, `x-api-key`, `Authorization`, `email`); (b) anidado a cualquier profundidad y dentro de arreglos; (c) deja intactos los demás campos (`playerId`, `quantity`); (d) no muta el objeto original; (e) tope de profundidad (por ejemplo 8) que devuelve `'[Truncated]'` en vez de recursar sin fin; (f) primitivos, `null` y `undefined` pasan sin cambios; (g) `redactQuery` aplica la misma regla; (h) `redactUrl('/notifications/stream?token=abc&x=1')` → `/notifications/stream?token=[REDACTED]&x=1`, sin query queda igual, con varias claves sensibles redacta todas, sin distinguir mayúsculas
- [X] T006 Crear `backend/src/shared/observability/logging/redaction.ts` con `REDACTED = '[REDACTED]'`, `redactBody(value: unknown): unknown`, `redactQuery(query: unknown): unknown` y `redactUrl(url: string): string` según T005 (ver `research.md` §8 y `data-model.md` → Campo sensible)
- [X] T007 [P] Crear `backend/src/modules/observability/logging.constants.ts` con los tokens `LOG_CONFIG` y `LOG_ROOT_LOGGER` (`Symbol`) y la interfaz `LogConfig { level: string; stream?: { write(line: string): void } }` (el `stream` opcional es el destino sobrescribible en tests; sin él se escribe en stdout)
- [X] T008 [P] Crear `backend/test/observability/observability/helpers/log-capture.ts` con `createLogCapture()` que devuelve `{ config: LogConfig, lines(): Record<string, unknown>[], raw(): string, byCorrelationId(id: string): Record<string, unknown>[], clear(): void }`: `config` usa `level: 'info'` y un `stream` en memoria que acumula las líneas; `lines()` parsea cada línea como JSON y **falla con un error claro** si alguna no es JSON válido (sirve a FR-005)
- [X] T009 Crear `backend/src/modules/observability/logging-config.module.ts`: módulo que provee `LOG_CONFIG` (`useFactory: () => ({ level: resolveLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV) })`) y `LOG_ROOT_LOGGER` (`useFactory: (cfg: LogConfig) => pino({ level: cfg.level }, cfg.stream)`, con `inject: [LOG_CONFIG]`), y los exporta. Los tests sobrescriben `LOG_CONFIG` con `ProviderOverride` de `backend/test/test-app.ts`, y `LOG_ROOT_LOGGER` se reconstruye con ese valor

**Checkpoint**: Helpers y configuración listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Reconstruir qué pasó en una operación puntual (Priority: P1) 🎯 MVP

**Goal**: Toda request recibe un Correlation ID (UUID si no trae uno), presente en todos los logs emitidos durante la request y devuelto en `X-Correlation-Id`, incluso en 401, 404 y 400 por JSON inválido; dos requests concurrentes no se mezclan.

**Independent Test**: Enviar requests concurrentes (éxito, 401, 404, 400 de parser) y verificar que cada respuesta trae su header y que filtrando los logs capturados por ese id aparecen sólo las líneas de esa request, incluida la del filtro de excepciones.

### Tests for User Story 1 ⚠️ (escribirlos primero y verificar que fallan)

- [X] T010 [P] [US1] Crear `backend/src/shared/observability/logging/request-log-options.spec.ts` (unit, falla hasta T012): `buildRequestLogOptions(logger)` devuelve `quietReqLogger: true` y `customAttributeKeys.reqId === 'correlationId'`; su `genReqId(req, res)` sin header devuelve un UUID v4, llama a `res.setHeader('X-Correlation-Id', <ese id>)` y dos llamadas devuelven ids distintos; el serializador de `res` emite sólo `{ statusCode }`; el de `req` emite sólo `{ method, url }` (sin headers) con la URL pasada por `redactUrl`; `customLogLevel` devuelve `error` para 5xx, `warn` para 4xx e `info` para el resto
- [X] T011 [P] [US1] Crear `backend/test/observability/request-logging.e2e-spec.ts` con `describe` de US1 (usa `createTestApp([{ token: LOG_CONFIG, useValue: capture.config }])` con `createLogCapture()` de T008; `capture.clear()` en `beforeEach`): (a) `GET /` → header `x-correlation-id` con forma de UUID v4 y una línea de log con ese `correlationId`; (b) `GET /auth/me` sin token → 401 con header y línea de log; (c) `GET /ruta-que-no-existe` → 404 con header y línea de log; (d) `POST /auth/login` con `Content-Type: application/json` y cuerpo `{"a":` (JSON inválido) → 400 con header y línea de log; (e) en el caso (b) las líneas con ese `correlationId` incluyen la de cierre de request **y** la del `AllExceptionsFilter` (`context: 'AllExceptionsFilter'`), probando que los logs emitidos por otros componentes llevan el id (FR-008); (f) 10 requests concurrentes mezclando `GET /` y `GET /auth/me` con `Promise.all`: todos los ids son distintos y, para cada id, todas las líneas capturadas con ese `correlationId` pertenecen a su request (mismo método y URL) y ninguna línea de otra request lo comparte (FR-010)

### Implementation for User Story 1

- [X] T012 [US1] Crear `backend/src/shared/observability/logging/request-log-options.ts` con `buildRequestLogOptions(logger: pino.Logger)` que devuelve las opciones de `pino-http`: `logger`, `quietReqLogger: true`, `customAttributeKeys: { reqId: 'correlationId' }`, `genReqId` (por ahora `randomUUID()` + `res.setHeader('X-Correlation-Id', id)`), `serializers` (`req` → `{ method, url: redactUrl(url) }`, sin headers; `res` → `{ statusCode }`) y `customLogLevel` (5xx o error → `'error'`, 4xx → `'warn'`, resto → `'info'`). Importar `redactUrl` de `./redaction`
- [X] T013 [US1] Crear `backend/src/shared/observability/logging/configure-request-logging.ts` con `configureRequestLogging(app: INestApplication)`: obtiene `LOG_ROOT_LOGGER` con `app.get(...)` y registra `app.use(pinoHttp(buildRequestLogOptions(logger)))`. **Debe llamarse antes de `listen`/`init`** para quedar delante del body parser (ver `research.md` §2). Comentario breve explicando el porqué (el 400 por JSON inválido)
- [X] T014 [US1] Crear `backend/src/modules/observability/logging.module.ts`: importa `LoggingConfigModule` y `LoggerModule.forRootAsync({ imports: [LoggingConfigModule], inject: [LOG_ROOT_LOGGER], useFactory: (logger) => ({ pinoHttp: { ...buildRequestLogOptions(logger), autoLogging: false } }) })`. `autoLogging: false` evita una segunda línea de cierre; este módulo sólo aporta el `Logger` de Nest y el contexto por request (FR-008)
- [X] T015 [US1] Registrar `LoggingModule` en el array `imports` de `backend/src/app.module.ts`
- [X] T016 [US1] En `backend/src/main.ts`: `NestFactory.create(AppModule, { bufferLogs: true })`, luego `app.useLogger(app.get(Logger))` (`Logger` de `nestjs-pino`) y `configureRequestLogging(app)`, todo antes de las migrations/seeds y de `app.listen`. No cambiar el resto de la secuencia de arranque
- [X] T017 [US1] En `backend/test/test-app.ts`, después de `createNestApplication()` y antes de `app.listen(0)`: `app.useLogger(app.get(PinoLogger))` (`Logger` de `nestjs-pino`) y `configureRequestLogging(app)`. No cambiar la firma de `createTestApp` ni de `TestContext`
- [X] T018 [US1] **Verificar `docker info` primero.** Correr desde `backend/`: `pnpm test:unit` y `pnpm test:e2e -- request-logging.e2e-spec protected.e2e-spec`. T010 y T011 pasan, `backend/test/architecture.spec.ts` sigue en verde y `protected.e2e-spec` también

**Checkpoint**: US1 funcional: toda request tiene Correlation ID en header y en todos sus logs (MVP).

---

## Phase 4: User Story 2 - Registro automático de toda request con sus datos clave (Priority: P1)

**Goal**: Cada request deja una entrada JSON con usuario (o `"anónimo"`), método, endpoint, query, params, cuerpo redactado y acotado, status y duración, sin que ningún endpoint tenga que invocar el logging; toda línea de log del backend es JSON.

**Independent Test**: Invocar un endpoint público, uno autenticado, uno con cuerpo y uno con parámetro de ruta, y verificar que cada uno deja una entrada con los campos de FR-003; el cuerpo de la respuesta no aparece.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Ampliar `backend/src/shared/observability/logging/request-log-options.spec.ts` con los casos de US2 (agregar un `describe` nuevo, sin tocar los de T010): `customSuccessObject(req, res, val)` agrega a `val` `userId` (= `req.user.userId`; `"anónimo"` cuando `req.user` no existe; nunca `null`), `route` (= `req.route?.path`, ausente si no hay), `params`, `query` (redactada) y `body` (redactado) sólo si `req.body` existe y no está vacío; si el cuerpo redactado serializado supera 2048 caracteres → `{ _truncated: true, preview: <primeros 2048> }`; si no es serializable (referencia circular) → `{ _unserializable: true }`; si el armado lanza, devuelve `val` sin campos extra y no relanza (FR-015); `customErrorObject` agrega los mismos campos; el resultado nunca contiene la clave `err`/`res` con cuerpo de respuesta
- [X] T020 [P] [US2] Ampliar `backend/test/observability/request-logging.e2e-spec.ts` con un `describe` nuevo de US2: (a) request autenticada (registrar y loguear un usuario, `GET /auth/me` con el JWT): la línea de cierre tiene `userId` igual al id del usuario, `req.method`, `req.url`, `res.statusCode: 200`, `responseTime` numérico ≥ 0, `time` y `correlationId`; (b) `GET /` sin credenciales: `userId: "anónimo"`; (c) `POST /auth/login` con credenciales inválidas: línea con `body` presente, `res.statusCode` 401 y `level: 40`; (d) un endpoint con parámetro de ruta (por ejemplo el detalle de jugador de `PlayerController`) con query string: la línea trae `route` con el patrón (`:id`), `params` con el valor y `query` con los parámetros; (e) request sin cuerpo: no existe la clave `body`; (f) la línea de un login exitoso no contiene la clave `accessToken` ni el valor del token (el cuerpo de respuesta no se loguea, FR-013); (g) `capture.lines()` no lanza: **toda** línea capturada, incluidas las del arranque de la app, es JSON válido (FR-005)

### Implementation for User Story 2

- [X] T021 [US2] En `backend/src/shared/observability/logging/request-log-options.ts` agregar `MAX_LOGGED_BODY_LENGTH = 2048`, una función `buildRequestLogFields(req)` que arma `{ userId, route, params, query, body }` (usuario `req.user?.userId ?? 'anónimo'`; `params`/`query`/`body` pasan por `redactBody`/`redactQuery` de `./redaction`; `body` omitido si `undefined` o vacío; truncado/unserializable según T019; todo dentro de `try/catch`) y conectarla en `customSuccessObject` y `customErrorObject`, que devuelven `{ ...val, ...campos }` (no usar `customProps`: duplica claves, ver `research.md` §3)

**Checkpoint**: US1 + US2: cada request deja su entrada completa.

---

## Phase 5: User Story 3 - Que los logs nunca expongan credenciales ni datos personales (Priority: P1)

**Goal**: Ni contraseñas, ni JWT, ni API keys, ni email aparecen en ninguna línea de log, en ningún campo, incluida la URL del stream de notificaciones que lleva el token.

**Independent Test**: Registrar y loguear un usuario con valores conocidos, emitir y usar una API key y abrir el stream de notificaciones con token en la URL; ningún valor sensible aparece en el texto completo de los logs capturados.

### Tests for User Story 3 ⚠️

- [X] T022 [P] [US3] Ampliar `backend/src/shared/observability/logging/request-log-options.spec.ts` con un `describe` nuevo de US3: con un `req` falso que trae `headers: { authorization: 'Bearer abc', 'x-api-key': 'pmk_xyz', cookie: 'a=b' }` el serializador de `req` no emite ninguna clave de headers ni esos valores; una URL `/notifications/stream?token=eyJ.a.b` sale con `token=[REDACTED]`; `customSuccessObject` redacta `password`, `Password`, `email`, un `accessToken` anidado y un arreglo de objetos con `token`, y `query: { token: 'x' }` sale redactada
- [X] T023 [US3] Ampliar `backend/test/observability/request-logging.e2e-spec.ts` con un `describe` nuevo de US3 (usar valores conocidos: email `secreto.logs@mail.com`, contraseña `Abcd1234!`): registrar, loguear (guardar el `accessToken` devuelto), emitir una API key (`POST /auth/api-key` con el JWT, guardar `apiKey`) y usarla en un endpoint que la acepte con el header `x-api-key`; abrir `GET /notifications/stream?token=<JWT>` con `http.get`, esperar los headers de respuesta y destruir la conexión (la línea se emite al cerrar), y también `GET /notifications/stream?token=token-invalido` (401). Aserciones sobre `capture.raw()` (texto completo): no contiene `Abcd1234!`, `secreto.logs@mail.com`, el JWT, el valor de la API key ni `Bearer`; las líneas del registro/login tienen `body.password === '[REDACTED]'` y `body.email === '[REDACTED]'`; la línea del stream tiene una URL que termina en `token=[REDACTED]`. Si algún mensaje del `AllExceptionsFilter` filtra el email (p. ej. el 409 de email repetido), anotar el hallazgo y resolverlo en T024
- [X] T024 [US3] Si T022/T023 revelan un hueco, corregir `backend/src/shared/observability/logging/redaction.ts` o `backend/src/shared/observability/logging/request-log-options.ts` (por ejemplo ampliar el patrón de claves sensibles o el serializador); para un hueco en `AllExceptionsFilter`, solo documentarlo en `specs/028-structured-request-logging/research.md` §14 y avisar al usuario: ese archivo y su spec existente no se modifican sin permiso explícito. Si no hay huecos, dejar la tarea marcada sin cambios de código

**Checkpoint**: US1–US3: trazabilidad completa y segura.

---

## Phase 6: User Story 4 - Reutilizar el identificador que ya trae la request (Priority: P2)

**Goal**: Un `X-Correlation-Id` entrante válido se reutiliza tal cual en logs y respuesta; uno vacío, largo o con caracteres no permitidos se descarta y se genera uno propio.

**Independent Test**: Enviar tres requests con el mismo id válido y comprobar que los logs de las tres se recuperan con ese único valor y que cada respuesta lo devuelve; enviar ids inválidos y comprobar que reciben un UUID propio.

### Tests for User Story 4 ⚠️

- [X] T025 [P] [US4] Crear `backend/src/shared/observability/logging/correlation-id.spec.ts` (unit, falla hasta T027): `resolveCorrelationId(incoming, generate?)` reutiliza un valor válido (`mi-id-123`, `retry:7f3a.001_x`, un UUID, exactamente 64 caracteres); genera uno nuevo para `undefined`, cadena vacía, 65 caracteres, valores con espacio, comillas, `<`, salto de línea o caracteres de control, y para un arreglo (`string[]`, header repetido); el generador se inyecta (parámetro con default `randomUUID`) para poder verificar que se invoca sólo cuando hace falta
- [X] T026 [US4] Ampliar `backend/test/observability/request-logging.e2e-spec.ts` con un `describe` nuevo de US4: (a) `GET /` con `X-Correlation-Id: mi-id-123` → la respuesta devuelve exactamente `mi-id-123` y la línea de log trae `correlationId: 'mi-id-123'`; (b) tres requests con el mismo id válido → `capture.byCorrelationId(id)` devuelve las líneas de las tres (3 líneas de cierre) y cada respuesta lo devuelve; (c) id con espacios y comillas (`a b"c`) → la respuesta trae un UUID v4 distinto del enviado, y los logs usan ese UUID; (d) id de 65 caracteres y id vacío → UUID generado; (e) un id con saltos de línea no llega a la app (Node lo rechaza): verificar con un cliente que lo permita o dejarlo cubierto por el unit de T025

### Implementation for User Story 4

- [X] T027 [US4] Crear `backend/src/shared/observability/logging/correlation-id.ts` con `CORRELATION_ID_HEADER = 'X-Correlation-Id'`, `MAX_CORRELATION_ID_LENGTH = 64`, `CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/` y `resolveCorrelationId(incoming: string | string[] | undefined, generate: () => string = randomUUID): string` según T025 (FR-006/FR-007; ver `research.md` §7)
- [X] T028 [US4] En `backend/src/shared/observability/logging/request-log-options.ts` cambiar `genReqId` para que use `resolveCorrelationId(req.headers['x-correlation-id'])` y `CORRELATION_ID_HEADER` en el `res.setHeader`. Los tests de T010 siguen válidos (sin header se genera un UUID)

**Checkpoint**: Las cuatro historias funcionan y están probadas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: CORS, documentación (Principios VIII y X) y validación final

- [X] T029 [P] Crear `createCorsOptions(rawOrigins: string | undefined)` en `backend/src/shared/cors/cors-origins.ts` (devuelve `{ origin: parseCorsOrigins(rawOrigins), credentials: true, exposedHeaders: ['X-Correlation-Id'] }`) y su test en un archivo **nuevo** `backend/src/shared/cors/cors-options.spec.ts` (no tocar `cors-origins.spec.ts` si existe): verifica `exposedHeaders`, `credentials` y que `origin` respeta `CORS_ORIGIN` y el default `http://localhost:5173`
- [X] T030 En `backend/src/main.ts`: usar `app.enableCors(createCorsOptions(process.env.CORS_ORIGIN))` en lugar del objeto inline, y agregar a la `setDescription` del `DocumentBuilder` una frase en español: toda respuesta incluye el header `X-Correlation-Id` (el cliente puede enviarlo para reutilizarlo en reintentos; valor de 1–64 caracteres alfanuméricos y `._:-`). Sin tocar el resto del arranque
- [X] T031 [P] Actualizar `docs/postman/desapp.postman_collection.json`: ampliar la `description` de la colección con una nota sobre `X-Correlation-Id` (se devuelve siempre; se puede enviar) y agregar un evento `test` a nivel colección con `pm.test('Responde X-Correlation-Id', function () { pm.expect(pm.response.headers.has('X-Correlation-Id')).to.be.true; });`. Mantener JSON válido y la indentación del archivo; verificarlo con `node -e "JSON.parse(require('fs').readFileSync('docs/postman/desapp.postman_collection.json','utf8'))"`
- [X] T032 [P] Ejecutar `pnpm lint` en `backend/` y corregir lo que falle en los archivos nuevos o editados
- [X] T033 Ejecutar `pnpm build` (`nest build`) en `backend/` sin errores
- [X] T034 **Verificar `docker info` primero.** Ejecutar la suite completa desde `backend/`: `pnpm test:unit`, `pnpm test:integration` y `pnpm test:e2e`. Todo en verde; ningún test existente modificado (`git diff` no debe mostrar cambios en archivos `*.spec.ts` o `*-spec.ts` ya existentes salvo los creados por esta feature). Si hay una falla en un test existente, corregir la implementación, no el test
- [X] T035 Recorrer `specs/028-structured-request-logging/quickstart.md` **contra una base desechable, no la de desarrollo**: levantar `docker run -d --name t028_pg -e POSTGRES_PASSWORD=t028 -e POSTGRES_DB=t028 -p 5544:5432 postgres:16-alpine`, arrancar el backend compilado con `PORT=3101 DATABASE_URL="postgresql://postgres:t028@127.0.0.1:5544/t028" NODE_ENV=test LOG_LEVEL=info node dist/src/main` desde `backend/`, repetir la tabla manual (id generado, entrante, inválido, 404, 401, JSON inválido, secretos, token en URL, traza por id con `jq`, solo JSON) y al final detener el backend y `docker rm -f t028_pg`
- [X] T036 **Verificar `docker info` primero.** Confirmar que el frontend sigue funcionando con el nuevo header y el logging: con `pnpm build` ya hecho en `backend/`, correr `pnpm test:integration` en `frontend/` (su `global-setup` levanta el backend compilado y espera `/health`). Anotar el resultado; no modificar archivos del frontend

---

## Phase 8: User Story 5 - Auditoría de negocio transversal con AOP (Priority: P2)

**Goal**: Una segunda capa, adicional al log técnico, que registra con un Interceptor de NestJS qué operación de negocio se ejecutó, quién y con qué resultado, sin que los controllers ni los services invoquen el registro (spec FR-018 a FR-025; diseño en [plan.md](./plan.md) "Segunda capa" y [research.md](./research.md) §15).

**Independent Test**: Ejecutar una compra, una venta que falla por tenencia insuficiente, una alerta y un recálculo de cotizaciones: cada ejecución deja una línea `event: "business_audit"` con su operación semántica, actor y resultado y el mismo `correlationId` que su línea técnica; una request 401/404/JSON ilegible/validación de DTO y una lectura no dejan ninguna; el e2e de cobertura falla si un `POST`/`PATCH`/`DELETE` no declara `@AuditedOperation`.

> **Estas tareas son el delta de la actualización de la spec** (T001–T036 ya estaban hechas y no se tocan). **Ningún test existente se modifica ni se borra**: todo test nuevo va en archivos nuevos. **Antes de las tareas que corren e2e** (T041, T042, T058, T060): `docker info`.

### Tests for User Story 5 ⚠️

> Escribirlos primero y verificar que fallan antes de implementar

- [X] T037 [P] [US5] Crear `backend/src/shared/observability/business-audit/audit-outcome.spec.ts` (unit, sin Nest; falla hasta T044): `classifyFailure` devuelve `rejected` para un `DomainError` y para un `HttpException` con status < 500 (400, 403, 404, 409) y `unexpected` para un `Error` común, un `HttpException` 500 y cualquier valor no-`Error`; `resolveActor(req, declared)` devuelve `req.user.userId` si existe, `"sistema"` si no hay usuario y se declaró `'system'`, `"anónimo"` si no hay usuario y se declaró `'anonymous'` o nada, y **nunca** lee el header `x-api-key`
- [X] T038 [P] [US5] Crear `backend/src/shared/observability/business-audit/audited-operation.decorator.spec.ts` (falla hasta T043): `@AuditedOperation('ALERT_CREATED')` guarda la operación y el actor por defecto (`'user'`) en los metadatos del handler y `getAuditedOperation(handler)` los devuelve; con `{ actor: 'system' }` guarda `'system'`; acepta una función `(req) => código` y `resolveOperation(metadata, req)` la evalúa; un handler sin decorator devuelve `undefined`
- [X] T039 [P] [US5] Crear `backend/src/shared/validation/request-validation-exception.spec.ts` (nuevo; **no** se toca `global-validation-pipe.spec.ts`; falla hasta T045): el `ValidationPipe` de `createGlobalValidationPipe()` ante un cuerpo inválido lanza una `RequestValidationException`, que además es `instanceof BadRequestException`, con el mismo status 400 y el mismo mensaje traducido a español de siempre
- [X] T040 [US5] Crear `backend/src/shared/observability/business-audit/business-audit.interceptor.spec.ts` (unit con un `ExecutionContext`/`CallHandler` de prueba y un `Logger` espiado; falla hasta T046; depende de T037 y T038): handler sin metadatos pasa de largo sin registrar; éxito → una línea `info` con `event: "business_audit"`, `operation`, `actor` y `outcome: "success"`; `DomainError` → `warn` con `outcome: "failure"` y `failureCategory: "rejected"`; error inesperado → `error` con `failureCategory: "unexpected"`; **relanza siempre** el error original sin cambiarlo; una `RequestValidationException` **no** registra nada y también se relanza; el registro no incluye método, ruta, parámetros, cuerpo, status, duración ni stack; un `Logger` que lanza no altera el valor devuelto ni el error relanzado (FR-025); una operación declarada como función `(req) => código` se resuelve contra la request (el caso concreto de las órdenes se prueba en T048)
- [X] T041 [US5] Crear `backend/test/observability/business-audit.e2e-spec.ts` (sobre `createTestApp()` con `LOG_CONFIG` capturado vía `backend/test/observability/helpers/log-capture.ts`; falla hasta T043–T057): compra y venta por `POST /orders` dejan `TOKENS_BOUGHT` y `TOKENS_SOLD`; una venta con tenencia insuficiente deja `failure`/`rejected`; crear una alerta deja `ALERT_CREATED` con el actor igual al UUID del usuario; `POST /quotes/recalculate` con la API key deja `QUOTES_RECALCULATED` con actor `"sistema"` y la API key no aparece en ninguna línea; **sin registro de negocio** para: `GET /auth/me` sin token (401), una ruta inexistente (404), un `POST /auth/login` con JSON ilegible, un `POST /orders` con un cuerpo que no pasa el DTO y cualquier `GET`; cada línea de negocio comparte el `correlationId` con la línea técnica de su request y **no** repite método, ruta, cuerpo, status ni duración; ningún secreto ni dato personal en la línea; un `jest.spyOn(Logger.prototype, 'log')` que lanza no cambia el status ni el cuerpo de la respuesta
- [X] T042 [P] [US5] Crear `backend/test/observability/business-audit-coverage.e2e-spec.ts` (usa `createTestApp()` y `listRouterRoutes`/`listDeclaredSla` de `backend/test/observability/helpers/route-inventory.ts`; falla hasta T048–T057): todo handler publicado con método `POST`, `PATCH` o `DELETE` tiene un `@AuditedOperation` (se leen los metadatos con `getAuditedOperation`), ninguna lectura (`GET`) lo tiene, y un meta-test con un conjunto sintético sin la declaración comprueba que la verificación detecta la falta (mismo patrón que `sla-coverage`). Si hace falta, ampliar `route-inventory.ts` con una función que devuelva el método de cada handler; **no** cambiar las existentes

### Implementation for User Story 5

- [X] T043 [US5] Crear `backend/src/shared/observability/business-audit/audited-operation.decorator.ts` (depende de T038): `AuditedOperation(operation: string | ((req: Request) => string), options?: { actor?: 'user' | 'system' | 'anonymous' })` con `SetMetadata` (clave propia), más `getAuditedOperation(handler)` y `resolveOperation(metadata, req)`. Mismo estilo que `backend/src/shared/observability/metrics/sla.ts`
- [X] T044 [US5] Crear `backend/src/shared/observability/business-audit/audit-outcome.ts` (depende de T037): `classifyFailure(error)` y `resolveActor(req, declared)` como en T037; funciones puras, sin Nest salvo los tipos de excepción
- [X] T045 [US5] Crear `backend/src/shared/observability/business-audit/request-validation.exception.ts` (`export class RequestValidationException extends BadRequestException`) y, en `backend/src/shared/validation/global-validation-pipe.ts`, hacer que el `exceptionFactory` devuelva `new RequestValidationException(translateValidationErrors(errors))` en lugar de `BadRequestException`. Status, mensaje y formato de error **no** cambian; no modificar `global-validation-pipe.spec.ts` (depende de T039)
- [X] T046 [US5] Crear `backend/src/shared/observability/business-audit/business-audit.interceptor.ts` (depende de T040, T043, T044, T045): `BusinessAuditInterceptor implements NestInterceptor`, con `Reflector`/`getAuditedOperation`; sin metadatos devuelve `next.handle()`; con metadatos `next.handle().pipe(tap({ next, error }))`, registra con `new Logger('BusinessAudit')` (el Correlation ID entra solo por el contexto de la request) los campos `event`, `operation`, `actor`, `outcome` y `failureCategory`, con nivel `info`/`warn`/`error`, **sin** método, ruta, parámetros, cuerpo, status, duración ni stack; ignora `RequestValidationException`; envuelve el registro en `try/catch`; no traga ni cambia el error
- [X] T047 [US5] Crear `backend/src/modules/observability/business-audit.module.ts` con `providers: [{ provide: APP_INTERCEPTOR, useClass: BusinessAuditInterceptor }]` e importarlo en `ObservabilityModule` (`backend/src/modules/observability/observability.module.ts`); no se toca `app.module.ts` (depende de T046)
- [X] T048 [P] [US5] `backend/src/controllers/orders/orders.controller.ts`: primero crear `backend/src/controllers/orders/order-operation.spec.ts` (nuevo, sin Nest; falla hasta que exista la función): `resolveOrderOperation(req)` devuelve `TOKENS_BOUGHT` si `req.body.side` es `OrderSide.BUY`, `TOKENS_SOLD` si es `OrderSide.SELL` y `ORDER_PLACED` si falta o no es ninguno de los dos (el interceptor corre antes del `ValidationPipe`, así que lee el cuerpo crudo; una orden con `side` inválido nunca se audita porque la validación del DTO la rechaza antes), sin tocar la request. Luego crear `backend/src/controllers/orders/order-operation.ts` con esa función, usando el enum `OrderSide` (no strings sueltos). Por último, en el controller: `POST /orders` → `@AuditedOperation(resolveOrderOperation)` y `DELETE /orders/:id` → `@AuditedOperation('ORDER_CANCELLED')`
- [X] T049 [P] [US5] `backend/src/controllers/alerts/alerts.controller.ts`: `POST /alerts` → `ALERT_CREATED`; `DELETE /alerts/:id` → `ALERT_DELETED`
- [X] T050 [P] [US5] `backend/src/controllers/notifications/notifications.controller.ts`: `PATCH /notifications/:id/read` → `NOTIFICATION_READ`; `PATCH /notifications/read-all` → `NOTIFICATIONS_ALL_READ`
- [X] T051 [P] [US5] `backend/src/controllers/user-strategy/user-strategy.controller.ts`: `PATCH …/:id/select` → `STRATEGY_SELECTED`; `PATCH …/:id/weights` → `STRATEGY_WEIGHTS_UPDATED`; `PATCH …/:id/position-weights/:position` → `STRATEGY_POSITION_WEIGHTS_UPDATED`
- [X] T052 [P] [US5] `backend/src/controllers/auth/auth.controller.ts`: `POST /auth/register` → `USER_REGISTERED` y `POST /auth/login` → `USER_LOGGED_IN`, ambos con `{ actor: 'anonymous' }` (un fallo de credenciales queda como `rejected`; el email y la contraseña no se registran)
- [X] T053 [P] [US5] `backend/src/controllers/api-key/api-key.controller.ts`: `POST /auth/api-key` → `API_KEY_ISSUED` (el valor emitido nunca se registra)
- [X] T054 [P] [US5] `backend/src/controllers/quotation/quotation.controller.ts`: `POST /quotes/recalculate` → `QUOTES_RECALCULATED` con `{ actor: 'system' }`
- [X] T055 [P] [US5] `backend/src/controllers/player-sync/player-sync.controller.ts`: `POST /sync/whoscored` → `PLAYER_SYNC_TRIGGERED` con `{ actor: 'system' }` (la consulta `GET /sync/whoscored/:runId` es una lectura: no se audita)
- [X] T056 [P] [US5] `backend/src/controllers/competition/football-data-sync.controller.ts`: `POST /sync/football-data` → `FOOTBALL_DATA_SYNC_TRIGGERED` con `{ actor: 'system' }`
- [X] T057 [P] [US5] `backend/src/controllers/simulation/simulation.controller.ts`: `POST /admin/simulate-market` → `MARKET_SIMULATED` (el actor sale de `req.user`, que adjunta `AdminAccessGuard`)
- [X] T058 [US5] **Verificar `docker info` primero.** Correr desde `backend/` (con `pnpm exec jest … --testPathPatterns`, no `pnpm test:unit -- …`): los unit de `business-audit`, `request-validation-exception` y los specs existentes de `validation`; luego `business-audit.e2e-spec` y `business-audit-coverage.e2e-spec`. Confirmar que el e2e `request-logging` y el resto de los e2e existentes siguen en verde sin tocarlos

### Polish de User Story 5

- [X] T059 Ejecutar `pnpm lint` y `pnpm build` en `backend/` sin errores; revisar que `backend/src/shared/observability/business-audit/` no importe nada de `repositories/` ni `services/` (el test de arquitectura tsarch lo verifica)
- [X] T060 **Verificar `docker info` primero.** Ejecutar la suite completa desde `backend/`: `pnpm test:unit`, `pnpm test:integration` y `pnpm test:e2e`, todo en verde, y confirmar con `git diff --stat -- "backend/**/*.spec.ts" "backend/test/**"` que ningún test existente fue modificado (sólo archivos nuevos)
- [X] T061 **Verificar `docker info` primero.** Recorrer el quickstart §4 ([quickstart.md](./quickstart.md)) contra una base desechable, no la de desarrollo (`docker run -d --name t028_pg -e POSTGRES_PASSWORD=t028 -e POSTGRES_DB=t028 -p 5544:5432 postgres:16-alpine`, backend con `PORT=3101`, `NODE_ENV=test`, `LOG_LEVEL=info`): compra, venta, rechazo de negocio, operación de sistema, requests sin registro y lectura; al final detener el backend y `docker rm -f t028_pg`
- [X] T062 Verificar la documentación (Principios VIII y X): no cambia ningún endpoint ni su contrato, así que Swagger y Postman no se tocan; dejar constancia en el reporte. Dejar los cambios **sin commitear** y proponer el nombre del commit en español (`feat: …`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 edita `package.json`: después de T001.
- **Foundational (Phase 2)**: depende de T001. Bloquea todas las historias. Dentro de la fase: T004 después de T003; T006 después de T005; T009 después de T004 y T007.
- **US1 (Phase 3)**: depende de Phase 2. Es el MVP. T012 → T013 → T014 → T015/T016/T017 → T018.
- **US2 (Phase 4)**: depende de US1 (extiende `request-log-options.ts` y reutiliza el e2e).
- **US3 (Phase 5)**: depende de US2 (la redacción actúa sobre los campos que US2 agrega).
- **US4 (Phase 6)**: depende de US1; es independiente de US2/US3 en lógica, pero comparte `request-log-options.ts` y `request-logging.e2e-spec.ts`, así que se hace después de ellas, no en paralelo.
- **Polish (Phase 7)**: depende de las historias incluidas. T030 después de T016 y T029 (mismo `main.ts`).
- **US5 (Phase 8)**: depende de US1 (Correlation ID y `Logger` con contexto de request) y es independiente de US2–US4. T037 y T038 y T039 en paralelo; T040 después de T037 y T038; T043–T045 antes de T046; T047 después de T046; T048–T057 en paralelo entre sí (un controller cada una) y después de T043; T058 al final de la implementación; T059–T062 cierran la fase.

### Within Each User Story

- Tests primero (verlos fallar) → implementación → correr.
- Los archivos compartidos (`request-log-options.ts`, `request-log-options.spec.ts`, `request-logging.e2e-spec.ts`, `main.ts`, `package.json`) se editan en secuencia, nunca en paralelo.

### Parallel Opportunities

- Foundational: T003, T005, T007 y T008 (archivos distintos) en paralelo.
- US1: T010 y T011 en paralelo.
- US2: T019 y T020 en paralelo.
- Polish: T029, T031 y T032 en paralelo (T030 espera a T029).

---

## Parallel Example: Foundational

```text
T003  backend/src/shared/observability/logging/log-level.spec.ts
T005  backend/src/shared/observability/logging/redaction.spec.ts
T007  backend/src/modules/observability/logging.constants.ts
T008  backend/test/observability/observability/helpers/log-capture.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001–T002 (dependencias) → Foundational T003–T009.
2. Tests de US1 (T010–T011), luego T012–T017 y T018.
3. **PARAR y VALIDAR**: toda respuesta (200/401/404/400) trae `X-Correlation-Id` y todos los logs de la request llevan ese id. Desplegable.

### Incremental Delivery

1. US1 → MVP (traza por id).
2. US2 (campos completos) → US3 (sin secretos, bloqueante para producción: no desplegar US2 sin US3) → US4 (reutilizar id entrante).
3. Polish: CORS, Swagger, Postman, lint, build, suite completa, quickstart, frontend.

---

## Notes

- Sin migraciones, sin variables obligatorias nuevas (`LOG_LEVEL` es opcional), sin cambios de frontend ni de endpoints.
- `AllExceptionsFilter` **no se modifica**; sus logs ganan el `correlationId` por el contexto de la request.
- **No desplegar US2 sin US3**: con los campos de query/cuerpo activos y sin la verificación de secretos, el log podría exponer datos.
- No hacer `git commit`: los cambios quedan sin commitear para que los revise el usuario.
- Los únicos archivos existentes que se editan son `package.json`, `.env.example`, `app.module.ts`, `main.ts`, `test/test-app.ts`, `shared/cors/cors-origins.ts` y la colección Postman; ningún test existente se modifica.

## Ajustes posteriores a la implementación

- **`username` redactado**: el patrón de claves sensibles pasó a `/pass|token|secret|api.?key|authorization|credential|email|user.?name/i` (T005/T006). El `userId` interno no se redacta.
- **Líneas duplicadas eliminadas**: `AllExceptionsFilter` dejó de loguear los 4xx (los registra el log de requests) y sólo loguea los 5xx, que traen el stack real; la línea de cierre de un 5xx descarta el `Error` fabricado por `pino-http`. El caso del filtro de T011(e) se reemplazó por: un 4xx deja una sola línea, y un 5xx forzado deja la de cierre y la del filtro con el mismo Correlation ID (FR-008). Ningún test preexistente cambió: `all-exceptions.filter.spec.ts` no asertaba sobre esos logs.
