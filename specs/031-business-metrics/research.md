# Research: Métricas de negocio en /metrics

Decisiones tomadas contrastando el plan del equipo con el código. No quedaron `NEEDS CLARIFICATION`.

## D1. Dónde contar el éxito de una orden

- **Decisión**: en `OrdersService.createOrder`, después de que `transactionManager.run(...)` resuelve. Tokens = suma de `fill.quantity`; volumen = suma de `fill.quantity × fill.price` (redondeada a 2 decimales), con `side` = el lado de la orden que inicia (se mide desde el iniciador; la contraparte queda fuera de alcance). Una orden sin fills es una operación exitosa (quedó registrada) que suma 0 tokens y 0 créditos.
- **Razón**: `DataSource.transaction` hace commit al resolver y rollback al rechazar; contar después garantiza que una orden revertida jamás figure (spec FR-006). Desde un controller no se cubriría el cron ni se sabría si hubo commit.
- **Alternativas**: medir en el controller (descartada: no cubre el cron y cuenta lo que luego se revierte); medir dentro de la transacción (descartada: contaría antes del commit).

## D2. Contador genérico de operaciones

- **Decisión**: `BusinessAuditInterceptor` incrementa `business_operations_total{operation,outcome}` dentro del mismo `record()` protegido por `try/catch`, reutilizando la operación resuelta y el resultado ya calculado. Mapeo: `success`, `rejected` y `unexpected` se pasan tal cual. `RequestValidationException` ya se descarta antes.
- **Razón**: las 16 operaciones de escritura (`@Post/@Put/@Patch/@Delete`) llevan `@AuditedOperation` (verificado; ya existe `business-audit-coverage.e2e-spec.ts`), así que el catálogo del decorador es el conjunto cerrado de `operation`. El `tap.next` del interceptor corre cuando el handler emite, es decir después de que el service terminó (commit incluido).
- **Matiz**: para `PLAYER_SYNC_TRIGGERED` el "éxito" es *corrida aceptada* (202), no *corrida terminada*; el resultado real de la corrida lo cuenta `sync_runs_total`. Son preguntas distintas y el HELP de `business_operations_total` lo dice explícitamente.

## D3. Motivos de rechazo

- **Decisión**: `rejectionReasonOf(error)` en `services/orders/order-rejection-reason.ts`: `InsufficientHoldingError → insufficient_tokens`; todo lo demás → `other`. Los valores `insufficient_balance` y `tokens_unavailable` existen en el conjunto cerrado y en el tipo para no romper el contrato si aparece el caso, pero hoy ningún error los produce.
- **Razón**: hoy no existe saldo monetario ni un error de "tokens no disponibles" (constitución 1.11.1; revisión de los errores de dominio). Inventarlos violaría "contar sólo lo que ocurre".
- **Alcance**: `market_order_rejections_total` sólo mide el alta de órdenes (compra/venta). Los rechazos de cancelación (no existe, ajena, no cancelable) figuran únicamente en `business_operations_total{outcome="rejected"}`. Sólo se cuenta un rechazo cuando el error es un `DomainError`; un error inesperado no es un rechazo.
- **Texto de ayuda (HELP)**: el de `market_order_rejections_total` aclara que mide sólo el alta de órdenes (compra y venta), no las cancelaciones.

## D4. Persistencia de la última sync exitosa

- **Hallazgo**: las corridas de WhoScored viven en un `Map` en memoria (máx. 20) y Football-Data no guarda ninguna. La precondición "las corridas quedan persistidas con su id" no se cumple.
- **Decisión**: tabla `sync_last_success(source varchar PK, succeeded_at timestamptz)` con migración, `SyncLastSuccessRepository` (`findAll()`, `upsert(source, at)`) y `SyncLastSuccessService`: `record(source, at)` hace upsert y fija el gauge; `onApplicationBootstrap` lee la tabla y siembra el gauge. Una fuente sin fila queda ausente. Un fallo al escribir o leer se registra en el log y no afecta la corrida ni el arranque.
- **Alternativas**: persistir las corridas completas (descartada: alcance mayor, no pedido); inferir la fecha del último `updated_at` de jugadores/partidos (descartada: no distingue corridas fallidas ni es confiable por fuente).

## D5. Resultado y duración de una corrida de sync y de recálculo

- **Decisión (sync, tres resultados)**: `success` si no abortó y **todas** las unidades terminaron bien (WhoScored: `failedUnits` vacío; Football-Data: `failedLeagues` vacío); `failure` si abortó con excepción **o** ninguna unidad terminó bien (WhoScored: `teamsSynced === 0` con `failedUnits > 0`; Football-Data: todas las ligas fallaron); `partial` en cualquier otro caso. Una función pura `classifySyncRun(...)` de `shared/observability/metrics` deriva el resultado del resumen, de modo que sea testeable sin infraestructura. El gauge y la tabla `sync_last_success` se actualizan **sólo con `success`**: con `partial` los datos de las unidades fallidas siguen viejos, y avanzar el gauge ocultaría esa desactualización. Se prefiere esta definición a contar la corrida parcial como exitosa (la versión anterior de esta decisión) porque con una caída casi total del proveedor la corrida "exitosa" taparía el problema.
- **Recálculo**: dos resultados (`success`, `failure`); `failure` ante una excepción. Las combinaciones salteadas (`skipped`) ya se informan en la respuesta y no cambian el resultado.
- **Duración**: medida con el `Clock` inyectado (de inicio a fin de la corrida) y observada en `finally`, con cualquier resultado.
- **Rechazos por lock**: Un `SyncInProgressError`/`RecalculationInProgressError` (409: la corrida no arrancó) **no** cuenta como corrida; el cron que se salta por lock tampoco.
- **Razón**: las fallas por unidad se tragan hoy; medir sólo excepciones haría casi invisible una caída total del proveedor, y contar una corrida mayormente fallida como exitosa ocultaría datos viejos.

## D6. Trigger

- **Decisión**: lo pasa quien inicia. WhoScored: `startManualRun`→`manual`, `sync()`→`scheduled`. Football-Data: `triggerManualRun`→`manual`, `handleCron`→`scheduled`. `recalculateAll(trigger)` (parámetro obligatorio): controller `manual`, `handleCron` `scheduled`. Simulación de mercado: `manual`, instrumentada en su propio paso de siembra de cotizaciones (no usa `recalculateAll`; hoy sólo el controller y el cron lo llaman).
- **Obligatorio, sin default**: la firma es `recalculateAll(trigger: RecalculationTrigger)`; omitirlo no compila, así que ningún llamador futuro puede quedar sin origen ni caer en uno por defecto.
- **Sin doble conteo (dueño único)**: el recálculo se mide en un solo lugar por corrida. `recalculateAll` mide las suyas; la simulación mide su propia siembra y **no** llama a `recalculateAll` (verificado: `MarketSimulationService` inyecta `QuotationService` pero sólo llama a `valuate`). Si en el futuro la simulación pasara a llamar `recalculateAll('manual')`, deberá dejar de medir por su cuenta; lo detectan dos tests: un unit que falla si la simulación invoca `recalculateAll` mientras mide, y un e2e que exige que `POST /admin/simulate-market` incremente `quote_recalculations_total{trigger="manual"}` exactamente en 1.
- **Razón**: no se deduce dentro del servicio; el valor interno `'cron'` de `SyncRunState` se traduce a `scheduled` en un solo punto.

## D7. Alertas, notificaciones y conexiones SSE

- **`alerts_triggered_total`**: en `QuoteRecalculatedListener`, una vez por cada alerta que cumple su condición, al emitir `alert.triggered`.
- **`notifications_created_total{delivery}`**: en `AlertNotificationListener`, después de `persist` exitoso. `live` si al empujar el usuario tenía al menos una conexión abierta; si no, `stored_only`.
- **Hallazgo**: `streams` conserva el `Subject` del usuario después de desconectarse, por lo que no sirve como señal de conexión. Se agrega un conteo de conexiones activas por usuario en `NotificationsService`: `subscribe(userId)` pasa a devolver un `Observable` que incrementa al suscribirse y decrementa en el teardown (`finalize`, que cubre cierre del cliente y error del stream); el mismo punto actualiza el gauge `sse_connections_active` (inc/dec). Varias pestañas de un usuario cuentan como varias conexiones.
- **Riesgo**: cambiar el tipo de retorno de `subscribe` puede afectar tests existentes del servicio; se ajustan sin cambiar el contrato HTTP del stream.

## D8. Cableado y registry compartido

- **Decisión**: `MetricsService` expone su `Registry` con un getter; `BusinessMetricsService` lo recibe por inyección y registra sus métricas ahí (mismo `/metrics`, aislado por instancia como en la 029). Se provee y exporta desde `MetricsModule` con el token `BUSINESS_METRICS` (interfaz `BusinessMetrics`), igual que `REQUEST_METRICS_RECORDER`. Los métodos son tipados por los conjuntos cerrados (un valor fuera del conjunto no compila) y cada cuerpo va en `try/catch` (nunca lanza).
- **Alternativa descartada**: un `Registry` propio combinado con `Registry.merge` al renderizar (más piezas sin beneficio).

## D9. Buckets

- **Sync** (segundos a decenas de minutos; Football-Data ≈ 70 s por los 7 s de espera entre requests, WhoScored bastante más): `[1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800]`.
- **Recálculo** (misma escala, con extremo inferior más fino; el costo crece con usuarios × jugadores): `[0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300]`. Provisorios: se ajustan tras medir una corrida real y se anotan en [quickstart.md](quickstart.md).

## D10. Dashboard y README

- Fila "Negocio" nueva al final de `futval-http-metrics.json` (mismo `uid`, `schemaVersion` 39), con paneles de: operaciones por resultado (`rate`), tokens y volumen por lado, rechazos por motivo, corridas y duración de sync por fuente (p95 con `histogram_quantile`), antigüedad de la última sync por fuente (`time() - sync_last_success_timestamp_seconds`), recálculos y duración, alertas y notificaciones por entrega, y conexiones SSE. README: tabla de las métricas de negocio junto a la de las técnicas.

## D11. Fuera de alcance (riesgos aceptados)

Métricas en memoria (se reinician con el backend, salvo la última sync exitosa); varias instancias exponen cada una las suyas; sin alertas sobre estos valores; sin medir la contraparte ni el order book; sin contar activaciones del fallback (no hay caché todavía); sin cambios en la constitución ni en los SLA.
