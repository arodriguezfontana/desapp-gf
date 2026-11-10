---

description: "Task list for Logging estructurado y trazabilidad de requests"

---

# Tasks: Logging estructurado y trazabilidad de requests

**Input**: Design documents from `specs/028-structured-request-logging/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/request-logging.md](./contracts/request-logging.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios — el Principio IX de la constitución exige casos felices y borde, unit tests y e2e con supertest sobre PostgreSQL efímero de Testcontainers. El test de arquitectura tsarch existente (`backend/test/architecture.spec.ts`) cubre las capas sin cambios. **Ningún test existente se modifica ni se borra**: las ampliaciones van en archivos nuevos.

**Organization**: Tareas agrupadas por user story de `spec.md` (US1–US3 son P1; US4 es P2). El código de producción es una sola tubería de logging: nace en US1 (Correlation ID + wiring), US2 le suma los campos de cada entrada, US3 prueba y cierra la redacción de secretos y US4 agrega la reutilización validada del id entrante. Los helpers puros que bloquean a todas las historias (nivel de log y redacción) están en Foundational.

**⚠️ Antes de cualquier tarea que corra e2e o integración** (T018, T034, T036): ejecutar `docker info`. Si Docker está apagado, el setup de tests cae en silencio a la base de desarrollo y los e2e **borran datos** (ya pasó). Si está apagado, levantar Docker Desktop y esperar a que `docker info` responda.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 (Correlation ID y traza completa), US2 (registro automático con campos), US3 (sin secretos en logs), US4 (reutilizar el id entrante)
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

- [X] T029 [P] Crear `createCorsOptions(rawOrigins: string | undefined)` en `backend/src/shared/cors-origins.ts` (devuelve `{ origin: parseCorsOrigins(rawOrigins), credentials: true, exposedHeaders: ['X-Correlation-Id'] }`) y su test en un archivo **nuevo** `backend/src/shared/cors-options.spec.ts` (no tocar `cors-origins.spec.ts` si existe): verifica `exposedHeaders`, `credentials` y que `origin` respeta `CORS_ORIGIN` y el default `http://localhost:5173`
- [X] T030 En `backend/src/main.ts`: usar `app.enableCors(createCorsOptions(process.env.CORS_ORIGIN))` en lugar del objeto inline, y agregar a la `setDescription` del `DocumentBuilder` una frase en español: toda respuesta incluye el header `X-Correlation-Id` (el cliente puede enviarlo para reutilizarlo en reintentos; valor de 1–64 caracteres alfanuméricos y `._:-`). Sin tocar el resto del arranque
- [X] T031 [P] Actualizar `docs/postman/desapp.postman_collection.json`: ampliar la `description` de la colección con una nota sobre `X-Correlation-Id` (se devuelve siempre; se puede enviar) y agregar un evento `test` a nivel colección con `pm.test('Responde X-Correlation-Id', function () { pm.expect(pm.response.headers.has('X-Correlation-Id')).to.be.true; });`. Mantener JSON válido y la indentación del archivo; verificarlo con `node -e "JSON.parse(require('fs').readFileSync('docs/postman/desapp.postman_collection.json','utf8'))"`
- [X] T032 [P] Ejecutar `pnpm lint` en `backend/` y corregir lo que falle en los archivos nuevos o editados
- [X] T033 Ejecutar `pnpm build` (`nest build`) en `backend/` sin errores
- [X] T034 **Verificar `docker info` primero.** Ejecutar la suite completa desde `backend/`: `pnpm test:unit`, `pnpm test:integration` y `pnpm test:e2e`. Todo en verde; ningún test existente modificado (`git diff` no debe mostrar cambios en archivos `*.spec.ts` o `*-spec.ts` ya existentes salvo los creados por esta feature). Si hay una falla en un test existente, corregir la implementación, no el test
- [X] T035 Recorrer `specs/028-structured-request-logging/quickstart.md` **contra una base desechable, no la de desarrollo**: levantar `docker run -d --name t028_pg -e POSTGRES_PASSWORD=t028 -e POSTGRES_DB=t028 -p 5544:5432 postgres:16-alpine`, arrancar el backend compilado con `PORT=3101 DATABASE_URL="postgresql://postgres:t028@127.0.0.1:5544/t028" NODE_ENV=test LOG_LEVEL=info node dist/src/main` desde `backend/`, repetir la tabla manual (id generado, entrante, inválido, 404, 401, JSON inválido, secretos, token en URL, traza por id con `jq`, solo JSON) y al final detener el backend y `docker rm -f t028_pg`
- [X] T036 **Verificar `docker info` primero.** Confirmar que el frontend sigue funcionando con el nuevo header y el logging: con `pnpm build` ya hecho en `backend/`, correr `pnpm test:integration` en `frontend/` (su `global-setup` levanta el backend compilado y espera `/health`). Anotar el resultado; no modificar archivos del frontend

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
- Los únicos archivos existentes que se editan son `package.json`, `.env.example`, `app.module.ts`, `main.ts`, `test/test-app.ts`, `shared/cors-origins.ts` y la colección Postman; ningún test existente se modifica.

## Ajustes posteriores a la implementación

- **`username` redactado**: el patrón de claves sensibles pasó a `/pass|token|secret|api.?key|authorization|credential|email|user.?name/i` (T005/T006). El `userId` interno no se redacta.
- **Líneas duplicadas eliminadas**: `AllExceptionsFilter` dejó de loguear los 4xx (los registra el log de requests) y sólo loguea los 5xx, que traen el stack real; la línea de cierre de un 5xx descarta el `Error` fabricado por `pino-http`. El caso del filtro de T011(e) se reemplazó por: un 4xx deja una sola línea, y un 5xx forzado deja la de cierre y la del filtro con el mismo Correlation ID (FR-008). Ningún test preexistente cambió: `all-exceptions.filter.spec.ts` no asertaba sobre esos logs.
