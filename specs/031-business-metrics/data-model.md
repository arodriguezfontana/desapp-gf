# Data Model: Métricas de negocio en /metrics

## Conjuntos cerrados de etiquetas

Definidos como constantes en `shared/observability/metrics/business-metrics.ts`; los métodos de `BusinessMetrics` reciben estos tipos, así que un valor fuera del conjunto no compila.

| Etiqueta | Valores | Uso |
|----------|---------|-----|
| `operation` | catálogo cerrado de `@AuditedOperation` (16 handlers de escritura, 18 nombres porque `POST /orders` resuelve a compra, venta u orden genérica: `TOKENS_BOUGHT`, `TOKENS_SOLD`, `ORDER_PLACED`, `ORDER_CANCELLED`, `ALERT_CREATED`, `ALERT_DELETED`, `API_KEY_ISSUED`, `USER_REGISTERED`, `USER_LOGGED_IN`, `PLAYER_SYNC_TRIGGERED`, `FOOTBALL_DATA_SYNC_TRIGGERED`, `QUOTES_RECALCULATED`, `MARKET_SIMULATED`, `NOTIFICATION_READ`, `NOTIFICATIONS_ALL_READ`, `STRATEGY_SELECTED`, `STRATEGY_WEIGHTS_UPDATED`, `STRATEGY_POSITION_WEIGHTS_UPDATED`) | `business_operations_total` |
| `outcome` (operaciones) | `success`, `rejected`, `unexpected` | `business_operations_total` |
| `outcome` (sync) | `success`, `partial`, `failure` | `sync_runs_total` |
| `outcome` (recálculo) | `success`, `failure` | `quote_recalculations_total` |
| `side` | `buy`, `sell` | tokens y volumen |
| `reason` | `insufficient_balance`, `insufficient_tokens`, `tokens_unavailable`, `other` | rechazos de órdenes |
| `source` | `whoscored`, `football_data` | sync |
| `trigger` | `scheduled`, `manual` | sync y recálculo |
| `delivery` | `live`, `stored_only` | notificaciones |

Ninguna etiqueta lleva ids de usuario, jugador, orden, alerta ni corrida.

## Métricas

| Métrica | Tipo | Etiquetas | Cuándo se actualiza |
|---------|------|-----------|---------------------|
| `business_operations_total` | counter | `operation`, `outcome` | `BusinessAuditInterceptor`, al terminar el handler (tras el service). `success` = operación aceptada; para `PLAYER_SYNC_TRIGGERED` significa "corrida aceptada", no "corrida terminada" |
| `market_tokens_traded_total` | counter | `side` | `OrdersService.createOrder`, tras el commit; suma `quantity` de los fills |
| `market_volume_credits_total` | counter | `side` | ídem; suma `quantity × price` de los fills |
| `market_order_rejections_total` | counter | `reason` | `OrdersService.createOrder`, ante un `DomainError`. Mide sólo el alta de órdenes (no las cancelaciones) |
| `sync_runs_total` | counter | `source`, `trigger`, `outcome` | al terminar cada corrida de sync |
| `sync_run_duration_seconds` | histogram | `source`, `trigger` | ídem (ambos resultados); buckets `[1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800]` |
| `sync_last_success_timestamp_seconds` | gauge | `source` | sólo tras una corrida `success` (no `partial` ni `failure`) y al arrancar (desde `sync_last_success`); ausente sin historial |
| `quote_recalculations_total` | counter | `trigger`, `outcome` | al terminar cada recálculo (incluida la simulación de mercado, `manual`) |
| `quote_recalculation_duration_seconds` | histogram | `trigger` | ídem; buckets `[0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300]` |
| `alerts_triggered_total` | counter | — | `QuoteRecalculatedListener`, por cada alerta que cumple su condición |
| `notifications_created_total` | counter | `delivery` | `AlertNotificationListener`, tras persistir |
| `sse_connections_active` | gauge | — | +1 al abrirse una conexión, −1 al cerrarse o fallar el stream |

## Resultado de una corrida de sync (derivación)

| Resultado | Condición | ¿Avanza el gauge de última sync? |
|-----------|-----------|----------------------------------|
| `success` | no abortó y **todas** las unidades terminaron bien (WhoScored: `failedUnits` vacío; Football-Data: `failedLeagues` vacío) | Sí |
| `partial` | no abortó; algunas unidades fallaron y otras no | No |
| `failure` | abortó con excepción, o ninguna unidad terminó bien (WhoScored: `teamsSynced === 0` con `failedUnits > 0`; Football-Data: todas las ligas fallaron) | No |

La clasificación es una función pura (`classifySyncRun`) sobre el resumen de la corrida. El recálculo de cotizaciones sólo distingue `success` (terminó) y `failure` (excepción). Una corrida rechazada por lock (409) o saltada por el cron no es una corrida y no se cuenta.

## Texto de ayuda (HELP) de las métricas con matices

- `business_operations_total`: "Operaciones de escritura de la API por tipo y resultado. success significa operación aceptada: para PLAYER_SYNC_TRIGGERED es corrida aceptada, no corrida terminada (su resultado real está en sync_runs_total)."
- `market_order_rejections_total`: "Órdenes de compra y venta rechazadas al crearse, por motivo. Mide sólo el alta de órdenes: no incluye las cancelaciones."

## Entidad nueva: `sync_last_success`

| Columna | Tipo | Notas |
|---------|------|-------|
| `source` | `varchar(32)` PK | `whoscored` o `football_data` |
| `succeeded_at` | `timestamptz` NOT NULL | momento de la última corrida exitosa de esa fuente |

- Una fila por fuente; `upsert` la reemplaza tras cada corrida `success`. Una corrida `partial` o `failure` nunca la toca.
- Al arrancar, el backend lee las filas y siembra el gauge (`succeeded_at` en segundos Unix). Sin fila, el gauge queda ausente.
- Sin claves foráneas ni datos personales. Migración `CreateSyncLastSuccess` (idempotente, como las existentes).

## Estado en memoria nuevo

- `NotificationsService`: conteo de conexiones SSE abiertas por usuario (`Map<userId, number>`), usado para decidir `live` vs `stored_only` y para el gauge.
