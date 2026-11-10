# Research: Métricas técnicas (latencia y tasa de error) y SLA por endpoint

Verificación del plan del equipo contra el código de la 028 (commit `95c384f`), el código fuente de `pino-http@11`
y dos spikes ejecutables: (1) una app de prueba con `prom-client@15.1.3` en un directorio temporal, y (2) un e2e
descartable sobre la app real que enumera el router de Express (ya borrado). No quedó ningún `NEEDS CLARIFICATION`.

## 1. Dónde se engancha la captura (corrige la precondición)

- **Hallazgo**: la 028 no tiene un `res.on('finish')` propio. `configureRequestLogging` registra `pinoHttp(buildRequestLogOptions(logger))` con `app.use`, antes del body parser. `pino-http` escucha `finish` y `close` (la primera que ocurra, una sola vez) y entonces llama a `customSuccessObject(req, res, val)` (o `customErrorObject(req, res, err, val)` para 5xx), con `val = { res, responseTime }`. La ruta sólo se agrega al log si `req.route?.path` existe; **no hay fallback `unmatched`** todavía.
- **Decision**: extender esos dos callbacks con una llamada a un `RequestMetricsRecorder` (interfaz en `shared/metrics`) y calcular ahí la etiqueta de ruta con fallback. Valores: `method = req.method` normalizado, `route = req.route?.path` o `unmatched`, `status_code = res.statusCode`, duración = `val.responseTime / 1000` (el mismo valor que sale en el log).
- **Rationale**: cumple "no crear middleware ni hook nuevo" y "no se recalculan por separado": mismo disparo, mismos valores, y cada request cuenta exactamente una vez en métricas y en log (FR-005) por construcción. `pino-http` evalúa los argumentos de `customSuccessObject` aunque el nivel del logger sea `silent`, así que la medición no depende del nivel de log (se prueba en e2e).
- **Alternatives considered**: un `res.on('finish')` propio con `process.hrtime` (más preciso, pero duplica la medición y la duración deja de coincidir con la del log; además agrega un segundo punto de captura); un Interceptor (descartado por la spec: no ve 401/404/400).
- **Riesgo conocido**: si `customLogLevel` devolviera `silent` para una ruta, `pino-http` retorna antes de evaluar los callbacks y esa ruta dejaría de medirse. Hoy nunca lo hace; un test lo fija.

## 2. `register` global de `prom-client` → un `Registry` por servicio

- **Hallazgo** (spike): registrar dos veces el mismo nombre en el registro global lanza `A metric with the name http_requests_total has already been registered`. Los tests e2e crean más de una app Nest en el mismo proceso Jest (por ejemplo `health.e2e-spec` y `request-logging.e2e-spec` ya lo hacen); con el registro global, la segunda app rompería.
- **Decision**: `MetricsService` crea `new Registry()` y registra ahí el `Histogram` y el `Counter` (`registers: [registry]`); `render()` devuelve `registry.metrics()`. **No** se llama a `collectDefaultMetrics`: la spec define exactamente dos métricas.
- **Rationale**: aislamiento por app/test, sin estado global compartido. `registry.metrics()` es asíncrono (devuelve `Promise<string>`) y `registry.contentType` vale `text/plain; version=0.0.4; charset=utf-8` (spike).
- **Alternatives considered**: `register.clear()` en cada test (frágil y global); `register` global con `getSingleMetric` (acopla a las apps entre sí).

## 3. Etiqueta de ruta: patrón de Express, `unmatched` y comodines

- **Hallazgo** (spike del router): la app real expone 33 rutas de controller como capas de ruta de Express (más `GET /health` y `GET /` ya incluidos), y **dos rutas `all {/*splat}`** que son las de los middleware de Nest. Con la 028, `req.route.path` al finalizar es el patrón del controller (`/players/:id/quotes`) y queda `undefined` para un 404 y para un 400 rechazado por el body parser (verificado en los e2e de la 028: la línea de esas requests no trae `route`).
- **Decision**: `resolveRouteLabel(req)`: `req.route?.path` si es un string sin comodines (`*`), si no `unmatched`. El rechazo por un guard (401/403) conserva su patrón (el guard corre después de resolver la ruta, verificado en la 028).
- **Rationale**: acota la cardinalidad (FR-006/FR-007): nunca path crudo, nunca ids ni query. La defensa contra comodines evita que, si algún día `req.route` apuntara a una capa `{/*splat}`, todo el tráfico quedara en una serie sin sentido. Los `OPTIONS` de CORS y los 400 de parser caen en `unmatched` y se separan por método/estado.
- **Sobre "404 y 400 mezclados en `unmatched`"**: son distinguibles por `status_code` (`unmatched/404`, `unmatched/400`), no por causa; no hace falta otra etiqueta.

## 4. Método HTTP acotado (FR-008) — faltaba en el plan

- **Decision**: `normalizeMethod(method)` devuelve el método si está en `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`, y `OTHER` en cualquier otro caso (incluido `undefined` y minúsculas inesperadas se pasan a mayúsculas antes de comparar).
- **Rationale**: un cliente podría enviar métodos inventados; sin este límite cada uno generaría una serie. (Node ya rechaza muchos métodos inválidos en el parser, por eso se prueba como unit y no por red.)

## 5. El stream en vivo no entra al histograma (FR-011) — faltaba en el plan

- **Decision**: `isStreamResponse(res)`: `res.getHeader('content-type')` empieza con `text/event-stream`. Si es verdadero, se incrementa el contador pero **no** se observa el histograma.
- **Rationale**: la duración de `GET /notifications/stream` es la de toda la conexión; distorsionaría p95/p99. Detectarlo por `content-type` evita hardcodear la ruta y cubre cualquier SSE futuro. El `content-type` ya está seteado cuando la conexión se cierra.
- **Consecuencia**: `http_request_duration_seconds_count` ≠ `http_requests_total` sólo por las series de stream, lo que justifica tener los dos instrumentos.

## 6. Buckets del histograma (FR-016) — faltaba en el plan

- **Decision**: `DURATION_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.8, 1, 2.5, 5, 10]`.
- **Rationale**: incluye exactamente cada umbral de latencia declarado (100, 250, 300, 500, 600, 800 ms y 1 s). Así "p95 ≤ objetivo" se verifica con la fracción de requests en `le="<umbral>"`, sin interpolar. Un test del e2e `sla-coverage` comprueba que todo umbral de `SLA_CLASSES` está en los buckets.
- **Alternatives considered**: los buckets por defecto de `prom-client` (no incluyen 0.3, 0.6 ni 0.8: el SLA no sería verificable con exactitud).

## 7. SLA: decorator y tabla de clases (corrige "comentario o decorator, a definir")

- **Hallazgo** (spike del router): se puede enumerar el router real (`app.getHttpAdapter().getInstance().router.stack`, capas con `route`) y las rutas por controller (`ModulesContainer` + metadatos `path`/`method` de `@nestjs/common`). Con eso se compara "rutas publicadas" contra "rutas con SLA".
- **Decision**: `@Sla('<clase>')` en cada handler; las clases (`auth`, `read`, `read-computed`, `write`, `market`, `system-trigger`, `system-status`, `system-long`, `stream`, `ping`, `technical`) viven en un único archivo (`shared/metrics/sla.ts`) con `{ p95Ms: number | null, maxErrorRate }`. `resolveSla(method, route)` se arma a partir de los metadatos. El test `sla-coverage` verifica: (a) cada ruta del router (sin comodines) tiene SLA y cada SLA corresponde a una ruta (FR-017); (b) el identificador `METODO /patrón` coincide con la etiqueta que producen las métricas (FR-015); (c) todo umbral ⊂ buckets (FR-016); (d) `GET /metrics` tiene SLA.
- **Rationale**: un comentario no puede fallar un test (FR-017). Las clases evitan repetir 35 pares de números; los valores coinciden con la tabla de la spec, y cambiar un objetivo es editar un lugar. Queda junto al código y se verifica contra lo que realmente se expone.
- **Alternatives considered**: comentario junto al controller (no verificable); archivo JSON/YAML aparte (se desincroniza de las rutas, que es justo lo que la spec quiere evitar); un decorator con los números en cada handler (35 duplicados).

## 8. `GET /metrics`

- **Decision**: `MetricsController` (`@Controller('metrics')`, `@Public()`, `@Sla('technical')`) devuelve `await metricsService.render()` con `res.type(registry.contentType)` (`@Res({ passthrough: true })`); Swagger con `@ApiTags('metrics')`, `@ApiOperation`, `@ApiProduces('text/plain')`, `@ApiResponse(200)`. Sin DTO: es texto plano.
- **Rationale**: sin el `Content-Type` correcto Nest respondería `text/html`; Prometheus acepta `text/plain; version=0.0.4`. El controller no contiene lógica (sólo el service).
- **`/metrics` se mide a sí mismo** (spec): su propia request se cuenta al finalizar, así que aparece desde la consulta siguiente.

## 9. Estrategia de pruebas (Principio IX)

- **Unit**: `request-metrics.spec` (etiquetas, `normalizeMethod`, `resolveRouteLabel` con comodín/undefined, `isStreamResponse`); `metrics.service.spec` (registro aislado por instancia, etiquetas, `record` con y sin duración, `render`); `sla.spec` (decorator, resolución, umbrales); `metrics.controller.spec`; `request-metrics-hook.spec` (archivo **nuevo**, no se toca `request-log-options.spec.ts`: el hook llama al recorder en éxito y error con los mismos valores del log; un fallo del recorder no rompe el log ni la respuesta; `customLogLevel` nunca devuelve `silent`).
- **E2E `metrics.e2e-spec.ts`** (sin sobrescribir `LOG_CONFIG`, para que el logger quede en `silent` y se pruebe que la medición no depende del log): `/metrics` sin credenciales → 200 con `text/plain`; sólo las dos familias; tras tráfico real hay series para 200, 401 (con su patrón), **404 y 400 por JSON malformado bajo `route="unmatched"`**, 5xx forzado (espía de `UserRepository.findById`); un mismo patrón con ids distintos produce una sola serie; 50 URLs inexistentes distintas no agregan series; el stream (conexión abierta y cortada) suma al contador y no al histograma; los 4xx y 5xx se cuentan por separado; el conteo de requests coincide con las líneas de log (se corre un caso aparte con `LOG_CONFIG` capturado).
- **E2E `sla-coverage.e2e-spec.ts`**: la verificación de FR-015/016/017 de §7.
- **Arquitectura**: el test tsarch existente cubre las capas nuevas sin cambios.
- **No tocar**: ningún test existente. `test-app.ts` no necesita cambios (`configureRequestLogging` ya se llama; el recorder llega por DI).

## 10. Documentación

- **Swagger**: `GET /metrics` (punto 8). **Postman**: request «Métricas — públicas, sin token (200)» con aserciones del `Content-Type` y de que aparecen las dos familias.
- **SLA**: la tabla de la spec es la referencia humana; la fuente verificable es `shared/metrics/sla.ts` + los decorators.
- **Documento de visión**: no está versionado (la constitución v1.12.0, Principio XIII, lo referencia por nombre y lo declara explícitamente). La tabla de endpoints sale de las rutas reales, como ya se decidió en la spec.

## 11. Fuera de alcance / riesgos

- Sin alerting ni tablero (spec). Sin métricas del proceso ni de negocio.
- Caché de consultas frecuentes e índices medidos (otras exigencias del Principio XIII): features aparte.
- Una sola instancia: métricas por proceso, se reinician con él.
- La captura depende de que la 028 siga siendo el punto de captura; si se reemplazara `pino-http`, hay que migrar el hook a donde quede el listener de finalización.
