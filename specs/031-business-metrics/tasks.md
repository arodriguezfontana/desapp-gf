---

description: "Lista de tareas de la feature 031: métricas de negocio en /metrics"
---

# Tasks: Métricas de negocio en /metrics

**Input**: Documentos de diseño en `/specs/031-business-metrics/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/business-metrics.md](contracts/business-metrics.md), [quickstart.md](quickstart.md)

**Tests**: Incluidos. La constitución (Principios IX y X) exige tests unitarios y e2e, y el plan fija los casos concretos (`partial`, `trigger` obligatorio, camino del cron, simulación sin doble conteo, medir sin alterar).

**Organization**: Las tareas se agrupan por historia de usuario de la spec. Todas las rutas son relativas a la raíz del repo; `backend/src/` es el código y `backend/test/` los e2e.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de la spec (US1 mercado, US2 sync, US3 cotización, US4 alertas/notificaciones, US5 Grafana)
- No se hace `git commit` en este proyecto: los cambios quedan sin commitear para el usuario.

---

## Phase 1: Setup

**Purpose**: confirmar el punto de partida; no hay dependencias nuevas.

- [X] T001 Verificar que `prom-client` ya está en `backend/package.json` (no instalar nada) y que `cd backend && pnpm build && pnpm test -- observability` pasan en verde antes de tocar código (línea base)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: constantes, interfaz, servicio de métricas y cableado que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

- [X] T002 Crear `backend/src/shared/observability/metrics/business-metrics.ts` con: nombres de las 12 métricas; tipos y constantes de los conjuntos cerrados (`side` buy/sell; `outcome` de operaciones success/rejected/unexpected; `outcome` de sync success/partial/failure; `outcome` de recálculo success/failure; `reason` insufficient_balance/insufficient_tokens/tokens_unavailable/other; `source` whoscored/football_data; `trigger` scheduled/manual; `delivery` live/stored_only); buckets de sync `[1,5,15,30,60,120,300,600,1200,1800]` y de recálculo `[0.05,0.1,0.25,0.5,1,2.5,5,10,30,60,120,300]`; textos HELP en español (con las aclaraciones de `business_operations_total` y `market_order_rejections_total` de [data-model.md](data-model.md)); la interfaz `BusinessMetrics` (un método tipado por métrica, ninguno devuelve ni lanza); el token `BUSINESS_METRICS` y la función pura `classifySyncRun(summary)` → `success | partial | failure` según [data-model.md](data-model.md). Sin imports de `prom-client` ni del dominio
- [X] T003 [P] Test unitario `backend/src/shared/observability/metrics/business-metrics.spec.ts`: `classifySyncRun` con todas las combinaciones (sin unidades fallidas → `success`; algunas fallidas y otras buenas → `partial`; todas fallidas → `failure`; corrida abortada → `failure`); los conjuntos cerrados contienen exactamente los valores de [data-model.md](data-model.md)
- [X] T004 Editar `backend/src/services/observability/metrics.service.ts` para exponer su `Registry` con un getter de sólo lectura (sin cambiar `record`, `render` ni las métricas de la 029)
- [X] T005 Crear `backend/src/services/observability/business-metrics.service.ts`: clase `BusinessMetricsService implements BusinessMetrics` que recibe `MetricsService`, registra las 12 métricas en su `Registry` (histogramas con los buckets de T002; `alerts_triggered_total` y `sse_connections_active` inicializados en 0) y cuyos métodos envuelven todo el cuerpo en `try/catch` vacío (nunca lanzan). Incluye `setSyncLastSuccess(source, date)` (segundos Unix) y `incSseConnections()` / `decSseConnections()`
- [X] T006 [P] Test unitario `backend/src/services/observability/business-metrics.service.spec.ts`: cada método incrementa/observa la serie con las etiquetas correctas leyendo `render()`; `setSyncLastSuccess` fija el gauge; el gauge SSE sube y baja; con un `Registry` que lanza (doble de `MetricsService` roto) ningún método lanza
- [X] T007 Editar `backend/src/modules/observability/metrics.module.ts` para proveer `BusinessMetricsService` y exportarlo bajo el token `BUSINESS_METRICS` (`useExisting`), igual que `REQUEST_METRICS_RECORDER`; agregar en `backend/src/modules/observability/metrics.constants.ts` la re-exportación del token si el patrón del módulo lo requiere
- [X] T008 Verificar que el test de arquitectura sigue verde: `cd backend && pnpm test -- architecture` (el dominio no importa `prom-client`; sin excepciones nuevas)

**Checkpoint**: `BusinessMetrics` inyectable por token y sus 12 series visibles en `GET /metrics`.

---

## Phase 3: User Story 1 - Medir la actividad del mercado (Priority: P1) 🎯 MVP

**Goal**: operaciones por tipo y resultado, tokens y volumen por lado, rechazos por motivo; sólo se cuenta como exitoso lo que quedó registrado.

**Independent Test**: compra exitosa + venta sin tokens; verificar series, que tokens/volumen sólo reflejan la exitosa y que un fallo al medir no cambia la respuesta ([quickstart.md](quickstart.md) escenarios 1, 2, 3, 5).

### Tests for User Story 1

- [X] T009 [P] [US1] Test unitario `backend/src/services/orders/order-rejection-reason.spec.ts`: `InsufficientHoldingError` → `insufficient_tokens`; `PlayerNotFoundError`, un `DomainError` cualquiera y un `Error` común → `other`
- [X] T010 [P] [US1] Extender `backend/src/shared/observability/business-audit/business-audit.interceptor.spec.ts`: éxito → `business_operations_total{outcome="success"}`; `DomainError` / `HttpException` 4xx → `rejected`; error común o 5xx → `unexpected`; `RequestValidationException` no cuenta; un `BusinessMetrics` que lanza no altera la respuesta ni el error relanzado
- [X] T011 [P] [US1] Extender `backend/src/services/orders/orders.service.spec.ts` (o el spec existente de `createOrder`): con fills, suma tokens y `quantity × price` (2 decimales) con el `side` de la orden iniciadora **después** del commit; sin fills suma 0; una transacción que rechaza (rollback) no suma nada; un rechazo `InsufficientHoldingError` incrementa `insufficient_tokens` y no los contadores de éxito; un `Error` inesperado no cuenta como rechazo; un `BusinessMetrics` que lanza no altera el resultado
- [X] T012 [P] [US1] Crear `backend/test/observability/business-metrics.e2e-spec.ts` (usa `createTestApp()` y `test/observability/helpers/prom-text.ts`) con los escenarios de mercado: compra exitosa sube operaciones, tokens y volumen; venta sin tokens sube `market_order_rejections_total{reason="insufficient_tokens"}` y `business_operations_total{outcome="rejected"}` sin tocar éxito/tokens/volumen; todos los valores de etiquetas pertenecen a los conjuntos cerrados; `/metrics` expone las doce familias; el HELP de `business_operations_total` y de `market_order_rejections_total` contiene las aclaraciones

### Implementation for User Story 1

- [X] T013 [P] [US1] Crear `backend/src/services/orders/order-rejection-reason.ts` con `rejectionReasonOf(error: unknown): RejectionReason` (`InsufficientHoldingError` → `insufficient_tokens`; todo lo demás → `other`)
- [X] T014 [US1] Editar `backend/src/shared/observability/business-audit/business-audit.interceptor.ts`: dentro del `record()` ya protegido por `try/catch`, incrementar `business_operations_total` con la operación resuelta y el resultado ya calculado (`success`, o `failure` + `rejected`/`unexpected`). Inyectar `BusinessMetrics` por token (opcional-seguro: si no está, no mide) y ajustar `backend/src/modules/observability/business-audit.module.ts` para importar `MetricsModule`
- [X] T015 [US1] Editar `backend/src/services/orders/orders.service.ts`: inyectar `BusinessMetrics`; en `createOrder`, tras resolver `transactionManager.run(...)`, registrar tokens y volumen de los fills con el `side` de la orden; envolver el alta para que un `DomainError` registre `market_order_rejections_total` con `rejectionReasonOf` y relance el error original. No medir `cancelOrder`
- [X] T016 [US1] Editar `backend/src/modules/orders/orders.module.ts` para importar `MetricsModule`
- [X] T017 [US1] Correr `cd backend && pnpm test -- orders business-audit order-rejection` y `pnpm test:e2e -- observability/business-metrics`; todo en verde. Confirmar que `business-audit-coverage.e2e-spec.ts` sigue verde (el catálogo de operaciones no cambió)

**Checkpoint**: US1 funcional y verificable sola (MVP).

---

## Phase 4: User Story 2 - Saber si los datos externos están al día (Priority: P1)

**Goal**: corridas de sync por fuente, origen y resultado (`success`/`partial`/`failure`), duración, y última exitosa persistida que sobrevive al reinicio.

**Independent Test**: corridas exitosa, parcial y fallida; sólo la exitosa mueve el gauge; reiniciar la app sobre la misma base y verificar que se conserva ([quickstart.md](quickstart.md) escenarios 7 y 8).

### Tests for User Story 2

- [X] T018 [P] [US2] Test de repositorio `backend/src/repositories/sync/sync-last-success.repository.integration.spec.ts` (Testcontainers, como `price-alert.repository.integration.spec.ts`): `upsert` crea y luego reemplaza la fila de una fuente; `findAll` devuelve una por fuente; sin filas devuelve vacío
- [X] T019 [P] [US2] Test unitario `backend/src/services/observability/sync-last-success.service.spec.ts`: `record(source, at)` hace upsert y fija el gauge; `onApplicationBootstrap` siembra el gauge desde `findAll`; sin filas el gauge queda ausente; un fallo del repository (al escribir o al leer) se registra en el log y no lanza
- [X] T020 [P] [US2] Extender `backend/src/services/player-sync/player-sync.service.spec.ts`: `startManualRun` cuenta `trigger=manual` y `sync()` cuenta `scheduled` (el `'cron'` interno se traduce); corrida con todas las unidades bien → `success`, actualiza la última sync y observa la duración con el `Clock` inyectado; **corrida con algunas unidades fallidas y otras buenas → `partial`: sube sólo `partial`, observa la duración y NO llama a `record` de la última sync**; sin ninguna unidad buena o abortada → `failure` sin tocar la última sync; `SyncInProgressError` (409) y el cron saltado por lock no cuentan corrida; un `BusinessMetrics` que lanza no altera el estado de la corrida
- [X] T021 [P] [US2] Extender `backend/src/services/competition/football-data-sync.service.spec.ts` con los mismos casos para Football-Data (`success` con `failedLeagues` vacío, `partial`, `failure` con todas las ligas fallidas, `triggerManualRun` → `manual`, `handleCron` → `scheduled`, lock no cuenta)
- [X] T022 [P] [US2] Extender `backend/test/observability/business-metrics.e2e-spec.ts` con: corrida `success` crea y avanza `sync_last_success_timestamp_seconds`; corrida `partial` incrementa `sync_runs_total{outcome="partial"}` y no mueve ni crea el gauge; corrida `failure` ídem; al recrear la app sobre la misma base el gauge se siembra desde `sync_last_success`. Usa los dobles de adapter existentes (`WHOSCORED_ADAPTER`, `FOOTBALL_DATA_ADAPTER`) vía `createTestApp(overrides)`

### Implementation for User Story 2

- [X] T023 [P] [US2] Crear la entidad `backend/src/repositories/sync/entities/sync-last-success.entity.ts` (`sync_last_success`: `source` varchar(32) PK, `succeeded_at` timestamptz NOT NULL), el mapper `backend/src/repositories/sync/sync-last-success.mapper.ts` y `backend/src/repositories/sync/sync-last-success.repository.ts` (`findAll()`, `upsert(source, at)`) devolviendo objetos simples de dominio, siguiendo el patrón de `notification.repository.ts`
- [X] T024 [P] [US2] Crear la migración idempotente `backend/src/database/migrations/1793200000000-CreateSyncLastSuccess.ts` (`CREATE TABLE IF NOT EXISTS`, como `1793000000001-CreateNotifications.ts`); verificar que el timestamp es posterior a la última migración existente
- [X] T025 [US2] Crear `backend/src/services/observability/sync-last-success.service.ts` (`record(source, at)` y `onApplicationBootstrap` según T019) y registrar entidad, repository y servicio en un módulo `backend/src/modules/observability/sync-last-success.module.ts` (`TypeOrmModule.forFeature`, importa `MetricsModule`, exporta el servicio)
- [X] T026 [US2] Editar `backend/src/services/player-sync/player-sync.service.ts`: inyectar `BusinessMetrics` y `SyncLastSuccessService`; en `runSyncAndRecord`, medir la duración con `this.clock` en `finally`, clasificar con `classifySyncRun` y registrar `sync_runs_total` y `sync_run_duration_seconds` con el `trigger` que ya recibe (`'cron'` → `scheduled`, `'manual'` → `manual`); llamar a `record(...)` de la última sync **sólo con `success`**. No contar rechazos por lock
- [X] T027 [US2] Editar `backend/src/services/competition/football-data-sync.service.ts`: misma instrumentación en `triggerManualRun` (`manual`) y `handleCron` (`scheduled`), clasificando el resumen (`failedLeagues`) con `classifySyncRun`; el error inesperado del cron cuenta `failure`; última sync sólo con `success`
- [X] T028 [US2] Importar `MetricsModule` y `SyncLastSuccessModule` en `backend/src/modules/player-sync/player-sync.module.ts` y `backend/src/modules/competition/football-data-sync.module.ts`
- [X] T029 [US2] Correr `cd backend && pnpm test -- sync && pnpm test:e2e -- observability/business-metrics`; todo en verde

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Seguir los recálculos de cotización (Priority: P2)

**Goal**: recálculos por origen y resultado con duración; `trigger` obligatorio; la simulación de mercado cuenta como `manual` sin doble conteo.

**Independent Test**: recálculo programado, manual y simulado; conteo exacto por origen ([quickstart.md](quickstart.md) escenarios 6, 9 y 10).

### Tests for User Story 3

- [X] T030 [P] [US3] Extender `backend/src/services/quotation/quotation.service.spec.ts`: `recalculateAll('manual')` incrementa `manual`/`success` y observa la duración; un fallo interno cuenta `failure` y relanza el mismo error; `RecalculationInProgressError` (409) no cuenta; **`handleCron()` llama a `recalculateAll('scheduled')` e incrementa `scheduled` y nunca `manual`**; el cron saltado por lock no cuenta; **una llamada `recalculateAll()` sin argumento lleva `// @ts-expect-error`** (si alguien le vuelve a dar un default, el spec deja de compilar); un `BusinessMetrics` que lanza no altera el resultado
- [X] T031 [P] [US3] Extender `backend/src/services/simulation/market-simulation.service.spec.ts`: `simulate()` mide `manual` exactamente una vez y **no invoca `recalculateAll`** (espía sobre `QuotationService`; falla si lo invoca mientras mide por su cuenta); un fallo en la siembra de cotizaciones cuenta `failure`
- [X] T032 [P] [US3] Extender `backend/test/observability/business-metrics.e2e-spec.ts`: `POST /quotes/recalculate` (API key admin) sube `quote_recalculations_total{trigger="manual",outcome="success"}` y observa la duración; **`POST /admin/simulate-market` incrementa `quote_recalculations_total{trigger="manual"}` exactamente en 1**

### Implementation for User Story 3

- [X] T033 [US3] Editar `backend/src/services/quotation/quotation.service.ts`: cambiar la firma a `recalculateAll(trigger: RecalculationTrigger)` **obligatorio, sin default**; medir duración con `this.clock` y resultado (`success`/`failure`) alrededor de `runRecalculation` dentro del lock (el 409 no cuenta); `handleCron` pasa `'scheduled'`. Inyectar `BusinessMetrics`
- [X] T034 [US3] Editar `backend/src/controllers/quotation/quotation.controller.ts` para llamar `recalculateAll('manual')`, y ajustar los specs existentes que llamen a `recalculateAll()` (buscar con `grep -rn "recalculateAll" backend`) para que pasen el argumento
- [X] T035 [US3] Editar `backend/src/services/simulation/market-simulation.service.ts`: medir la siembra de cotizaciones (`seedQuotes` y el evento posterior) como `manual` con duración y resultado, **sin llamar a `recalculateAll`** y dejando un comentario que explique que es el dueño único de esa medición. Inyectar `BusinessMetrics`
- [X] T036 [US3] Importar `MetricsModule` en `backend/src/modules/quotation/quotation.module.ts` y `backend/src/modules/simulation/simulation.module.ts`
- [X] T037 [US3] Correr `cd backend && pnpm build && pnpm test -- quotation simulation && pnpm test:e2e -- observability/business-metrics`; todo en verde (el `build` confirma que ningún llamador omite `trigger`)

**Checkpoint**: US1, US2 y US3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Seguir alertas y notificaciones en tiempo real (Priority: P2)

**Goal**: alertas disparadas, notificaciones por entrega (en vivo o guardada) y conexiones SSE abiertas sin desfase.

**Independent Test**: alerta con usuario conectado y otra sin conexión; el gauge sube y baja con las conexiones ([quickstart.md](quickstart.md) escenario 12).

### Tests for User Story 4

- [X] T038 [P] [US4] Extender `backend/src/services/alerts/quote-recalculated.listener.spec.ts` (o crearlo): una alerta que cumple su condición suma `alerts_triggered_total` en 1; las que no cumplen, no; un `BusinessMetrics` que lanza no impide emitir `alert.triggered`
- [X] T039 [P] [US4] Extender `backend/src/services/notifications/notifications.service.spec.ts`: `subscribe(userId)` devuelve un `Observable` que cuenta la conexión al suscribirse y la descuenta al cancelar la suscripción, al completarse y **al fallar el stream**; varias conexiones del mismo usuario cuentan por separado; `pushToStream` indica si había conexión abierta (no basta con que exista el `Subject`: tras desconectar, el usuario ya no está conectado); ajustar los tests existentes de `subscribe` al nuevo tipo de retorno
- [X] T040 [P] [US4] Extender `backend/src/services/notifications/alert-notification.listener.spec.ts` (o crearlo): usuario conectado → `notifications_created_total{delivery="live"}`; sin conexión → `stored_only`; se cuenta sólo después de persistir (si `persist` falla, no suma); un `BusinessMetrics` que lanza no altera la entrega
- [X] T041 [P] [US4] Extender `backend/test/observability/business-metrics.e2e-spec.ts`: alerta disparada con el usuario conectado al stream SSE → `live`; sin conexión → `stored_only`; `sse_connections_active` sube al conectar y vuelve a 0 al cerrar (incluido un cierre abrupto del cliente)

### Implementation for User Story 4

- [X] T042 [US4] Editar `backend/src/services/notifications/notifications.service.ts`: mantener un conteo de conexiones abiertas por usuario (`Map<string, number>`); `subscribe(userId)` devuelve un `Observable` que incrementa al suscribirse y decrementa en el teardown (`finalize`) actualizando `sse_connections_active`; `pushToStream` devuelve si el usuario tenía al menos una conexión abierta. Mantener intacto el contrato del stream y el controller `backend/src/controllers/notifications/notifications-sse.controller.ts` (sólo ajustar el tipo si hace falta)
- [X] T043 [US4] Editar `backend/src/services/notifications/alert-notification.listener.ts`: tras `persist`, empujar al stream y registrar `notifications_created_total` con `live` si había conexión y `stored_only` si no
- [X] T044 [US4] Editar `backend/src/services/alerts/quote-recalculated.listener.ts`: registrar `alerts_triggered_total` por cada alerta que cumple, antes de emitir `alert.triggered`
- [X] T045 [US4] Importar `MetricsModule` en `backend/src/modules/notifications/notifications.module.ts` y `backend/src/modules/alerts/alerts.module.ts`
- [X] T046 [US4] Correr `cd backend && pnpm test -- notifications alerts && pnpm test:e2e -- observability/business-metrics notifications`; todo en verde (incluidos los e2e existentes de notificaciones y alertas)

**Checkpoint**: las cuatro áreas de negocio miden y son verificables.

---

## Phase 7: User Story 5 - Ver el negocio en Grafana (Priority: P2)

**Goal**: fila "Negocio" en el dashboard provisionado, sin configuración manual.

**Independent Test**: con tráfico generado, abrir el dashboard y ver las cuatro áreas sin paneles vacíos donde hubo actividad ([quickstart.md](quickstart.md) sección 2).

- [X] T047 [US5] Editar `backend/grafana/dashboards/futval-http-metrics.json` agregando al final una fila (`type: row`) "Negocio" con paneles y consultas de la tabla de [contracts/business-metrics.md](contracts/business-metrics.md): operaciones por resultado, tokens y volumen por lado, rechazos por motivo, corridas de sync por fuente y resultado (incluido `partial`), duración p95 de sync por fuente, antigüedad de la última sync por fuente (`time() - sync_last_success_timestamp_seconds`), recálculos por origen y resultado con su duración, alertas disparadas, notificaciones por entrega y conexiones SSE. Mantener `uid` y `schemaVersion`; ids de panel nuevos y `gridPos` debajo del último panel existente (y ≥ 28)
- [X] T048 [P] [US5] Validar el JSON con `node -e "JSON.parse(require('fs').readFileSync('backend/grafana/dashboards/futval-http-metrics.json','utf8'))"` y que no hay ids de panel repetidos
- [X] T049 [P] [US5] Editar `README.md` (sección de monitoreo, junto a la tabla de `GET /metrics`): lista de las métricas de negocio con su tipo, etiquetas y significado; la decisión de diseño (medir el negocio por separado de la API y contar sólo lo que ocurrió) y los riesgos aceptados (reinicio, varias instancias, sin alertas); aclarar que `PLAYER_SYNC_TRIGGERED` exitoso es "corrida aceptada" y que `partial` no avanza la última sync exitosa
- [X] T050 [US5] Verificación manual con Prometheus y Grafana levantados (`cd backend && docker compose up -d` y `pnpm dev`): generar tráfico, comprobar las consultas del contrato en `http://localhost:9090` y la fila **Negocio** en `http://localhost:3001/d/futval-http-metrics`; reiniciar el backend y confirmar que la antigüedad de la última sync se conserva. Anotar la duración observada de las corridas y ajustar los buckets si hace falta, en la tabla de calibración de [quickstart.md](quickstart.md)

**Checkpoint**: todas las historias completas.

---

## Phase 8: Polish y verificación final

- [X] T051 [P] Revisar con `grep -rn "prom-client" backend/src/domain` que el dominio no importa `prom-client`, y que ninguna etiqueta del código usa ids de usuario, jugador, orden, alerta o corrida
- [X] T052 [P] Revisar que los textos HELP, los mensajes de log y la documentación nueva están en español y los identificadores en inglés (Principio XI)
- [X] T053 Correr la suite completa y los gates de la constitución: `cd backend && pnpm lint && pnpm build && pnpm test && pnpm test:e2e` (con Testcontainers; si no arranca, dejar constancia de que cayó al fallback a la base de desarrollo)
- [X] T054 Confirmar que no hay endpoints, SLA ni variables de entorno nuevos: `git diff --stat` sobre `backend/src/controllers` sólo muestra el cambio de `quotation.controller.ts`; `sla-coverage.e2e-spec.ts` verde; Swagger y la colección de Postman sin cambios
- [X] T055 Recorrer [quickstart.md](quickstart.md) completo y completar su tabla de calibración; dejar todos los cambios **sin commitear**

---

## Notas de implementación

- Los tests de cada servicio quedaron en archivos `*.metrics.spec.ts` junto al servicio (en vez de extender los specs existentes) para no mezclar; los e2e comparten `backend/test/observability/business-metrics.e2e-spec.ts`.
- La entidad `sync_last_success` se accede sin clase mapper aparte: el repository mapea inline (dos campos, sin lógica).
- Se ajustó `backend/test/observability/metrics.e2e-spec.ts` (spec 029): ahora admite también las familias de negocio, que comparten el `Registry`.
- T050 y T055 se hicieron a mano el 2026-11-13 (ver el final de `quickstart.md`); WhoScored no se sincronizó contra el sitio real.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → historias (Phases 3–7) → **Polish (Phase 8)**.
- Foundational **bloquea** todas las historias (comparten `BusinessMetrics`, el servicio y el cableado).

### User Story Dependencies

- **US1 (P1)**: sólo Foundational. MVP.
- **US2 (P1)**: sólo Foundational (tabla y servicio propios).
- **US3 (P2)**: sólo Foundational; independiente de US1/US2.
- **US4 (P2)**: sólo Foundational.
- **US5 (P2)**: la fila usa series de las otras cuatro historias, pero el JSON se puede escribir y validar en cualquier momento; la verificación manual (T050) requiere US1–US4 terminadas.

### Within Each User Story

- Tests antes de la implementación (deben fallar primero), luego helpers/repositories, luego services, luego módulos, luego la corrida de verificación de la historia.
- T014 y T015 tocan archivos distintos pero ambos dependen de T005 y T007.
- Los tests e2e de las historias comparten `backend/test/observability/business-metrics.e2e-spec.ts` (se crea en T012): las tareas T022, T032 y T041 lo extienden y **no son paralelas entre sí** en el mismo archivo; hacerlas en el orden de las historias.

### Parallel Opportunities

- Foundational: T003 y T006 en paralelo tras T002 y T005.
- US1: T009, T010, T011, T012 y T013 en paralelo.
- US2: T018–T022 en paralelo; T023 y T024 en paralelo.
- US3: T030 y T031 en paralelo.
- US4: T038, T039 y T040 en paralelo.
- US5: T048 y T049 en paralelo.
- Con varias personas: tras Foundational, US1, US2, US3 y US4 se pueden repartir (cuidando el e2e compartido).

---

## Parallel Example: User Story 2

```text
# Tests en paralelo (archivos distintos):
T018  sync-last-success.repository.integration.spec.ts
T019  sync-last-success.service.spec.ts
T020  player-sync.service.spec.ts      (incluye el caso partial)
T021  football-data-sync.service.spec.ts

# Persistencia en paralelo:
T023  entidad + mapper + repository
T024  migración CreateSyncLastSuccess
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 y Phase 2 (fundamentos).
2. Phase 3 (US1): mercado medido.
3. **Parar y validar**: `/metrics` muestra operaciones, tokens, volumen y rechazos correctos; una operación rechazada o fallida nunca figura como exitosa.

### Incremental Delivery

1. Fundamentos → US1 (MVP) → US2 (datos al día, con `partial`) → US3 (cotización) → US4 (alertas y SSE) → US5 (Grafana y README) → Polish.
2. Cada historia suma series verificables sin romper las anteriores.

### Notas

- `trigger` de `recalculateAll` es obligatorio y sin default; el build es el gate que detecta llamadores que lo omiten.
- El gauge y la tabla de última sync avanzan **sólo con `success`**.
- `market_order_rejections_total` mide sólo el alta de órdenes; `insufficient_balance` y `tokens_unavailable` quedan en el conjunto cerrado sin series hasta que exista el caso.
- Medir nunca altera la operación medida: todo método de `BusinessMetrics` es seguro y cada punto instrumentado tiene su test con un doble que lanza.
