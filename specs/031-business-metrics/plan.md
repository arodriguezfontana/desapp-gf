# Implementation Plan: Métricas de negocio en /metrics

**Branch**: `031-business-metrics` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/031-business-metrics/spec.md` + plan técnico aportado por el equipo (un `BusinessMetricsService` separado que comparte el `Registry` de la 029, éxito contado tras el commit desde los services, contador genérico desde el `BusinessAuditInterceptor`), contrastado con el código real (ver [research.md](research.md)).

## Summary

Agregar al mismo `GET /metrics` doce métricas de negocio (`prom-client`, sin dependencias nuevas) con etiquetas de conjuntos cerrados: operaciones por tipo y resultado, tokens y volumen por lado, rechazos por motivo, corridas/duración/última exitosa de sync por fuente, recálculos de cotización por origen, alertas disparadas, notificaciones por forma de entrega y conexiones SSE abiertas. Un `BusinessMetricsService` nuevo, separado de `MetricsService`, comparte su `Registry`; sus métodos son tipados y **nunca lanzan**. Se agrega una fila "Negocio" al dashboard de Grafana de la 029 y se documenta en el README.

El plan del equipo se adopta con **cinco ajustes** que salieron de contrastarlo con el código:

1. **Las corridas de sync NO quedan persistidas** (precondición falsa). El servicio de WhoScored guarda las corridas en un `Map` en memoria (máx. 20, se pierden al reiniciar: el propio 404 de `GET /sync/whoscored/:runId` lo dice) y Football-Data no tiene estado de corrida. No hay "último registro persistido exitoso" del cual inicializar el gauge, y la spec (FR-008, SC-003) exige que sobreviva al reinicio. **Se agrega una tabla mínima `sync_last_success` (`source` PK, `succeeded_at`)** con su migración, repository y un servicio que la escribe tras cada corrida exitosa y la lee al arrancar. Es el único cambio de persistencia.
2. **`insufficient_balance` y `tokens_unavailable` no tienen hoy ningún error de dominio que los dispare**: el sistema no maneja saldo monetario (constitución 1.11.1) y no hay un error de "tokens no disponibles". El único rechazo de negocio mapeable es `InsufficientHoldingError` → `insufficient_tokens`; el resto (p. ej. `PlayerNotFoundError`) cae en `other`. Los cuatro valores quedan en el conjunto cerrado, pero dos no tendrán series hasta que exista el caso. Se documenta; no se inventan errores.
3. **`pushToStream` no distingue "conectado".** `NotificationsService.streams` guarda un `Subject` por usuario y **nunca lo borra** al desconectarse: "existe el stream" no equivale a "hay una conexión abierta". Contar `live` por la existencia del `Subject` marcaría como en vivo notificaciones sin destinatario. Se agrega un conteo de conexiones activas por usuario (el mismo que alimenta `sse_connections_active`): `live` si y sólo si el usuario tiene al menos una conexión abierta al empujar.
4. **El éxito de una corrida de sync se define por unidades, no sólo por excepción.** Las fallas por liga/equipo se tragan y la corrida igual termina "completed" (WhoScored) o devuelve el resumen (Football-Data): con una API key vencida casi toda corrida figuraría exitosa. Resultado de sync con tres valores: `success` si todas las unidades terminaron bien; `failure` si la corrida se abortó **o ninguna unidad terminó bien**; `partial` en el resto (algunas fallaron y otras no). El gauge `sync_last_success_timestamp_seconds` y la tabla `sync_last_success` avanzan **sólo con `success`**, para que una corrida mayormente fallida no oculte datos desactualizados. Los recálculos mantienen dos resultados (`success`, `failure`).
5. **`trigger` ya se conoce en los puntos de entrada**, no hace falta deducirlo: el servicio de WhoScored ya separa `startManualRun()` de `sync()` (cron) y el de Football-Data `triggerManualRun()` de `handleCron()`. Sólo `recalculateAll()` (compartido por el controller y el cron) recibe un parámetro nuevo `trigger`, **obligatorio y sin valor por defecto** para que el compilador marque a cualquier llamador que lo omita (hoy sólo lo llaman el controller y el cron). El valor interno `'cron'` de `SyncRunState` se mapea a `scheduled` en la métrica. La simulación de mercado no pasa por `recalculateAll()` (siembra cotizaciones y emite el evento por su cuenta): se instrumenta en su propio punto como `manual`.

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict`), Node.js 20, NestJS 11.2

**Primary Dependencies**: `prom-client@^15.1.3` (ya instalada), `@nestjs/schedule`, `@nestjs/event-emitter`, TypeORM. Sin dependencias nuevas

**Storage**: una tabla nueva `sync_last_success` (PostgreSQL, `timestamptz`) con migración; el resto de las métricas viven en memoria del proceso

**Testing**: Jest unit (servicio, mapa de motivos, `classifySyncRun` con sus tres resultados, `recalculateAll` con `trigger` obligatorio, camino del cron en `scheduled`, simulación sin doble conteo, listeners, services instrumentados con un doble de `BusinessMetrics`) y Jest + supertest e2e sobre `createTestApp()` con PostgreSQL efímero de Testcontainers; test de arquitectura tsarch existente

**Target Platform**: Servicio HTTP Linux/Docker, scrapeado por Prometheus y visualizado en Grafana

**Project Type**: web-service (monorepo; se toca `backend/`, `backend/grafana/` y `README.md`)

**Performance Goals**: sobrecosto despreciable por operación (incrementos en memoria; una escritura por corrida de sync); sin impacto en los SLA vigentes

**Constraints**: etiquetas de conjuntos cerrados definidos como constantes; el `HELP` de `business_operations_total` aclara que `PLAYER_SYNC_TRIGGERED` exitoso es "corrida aceptada, no terminada" y el de `market_order_rejections_total` que mide sólo el alta de órdenes; `BusinessMetricsService` nunca lanza; el dominio no importa `prom-client`; éxito contado sólo tras el commit; sin endpoints, SLA ni variables de entorno nuevas

**Scale/Scope**: ~8 archivos de producción nuevos, ~12 editados (interceptor, 5 services, 2 listeners, `MetricsService`, módulos, controller de recálculo), 1 migración, 1 dashboard, README

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Capas | ✅ | `BusinessMetricsService` vive en `services/observability` (usa `prom-client`, librería sin regla de aislamiento, igual que `MetricsService`). Los services dependen de la interfaz `BusinessMetrics` (en `shared/observability/metrics`) por token, no de la clase concreta. El dominio no importa `prom-client` ni la interfaz; el mapa error→motivo vive en `services/orders` (único lugar que ve a la vez errores de dominio y métricas). La tabla nueva se accede sólo vía Repository con mapper |
| II. Dominio rico | ✅ N/A | Sin lógica de negocio nueva; instrumentar no es lógica de negocio |
| III. Validación | ✅ N/A | Sin entradas nuevas |
| IV. Autenticación | ✅ | `/metrics` sigue público como en la 029; las etiquetas no llevan ids, usuarios, jugadores ni corridas |
| V. Auditoría inmutable | ✅ | Sin cambios; las métricas no reemplazan ni tocan el log de auditoría |
| VI. Integridad transaccional | ✅ | Los contadores de éxito, tokens y volumen se actualizan **después** de que `transactionManager.run` resuelve (commit); una orden revertida no suma. Medir queda fuera de la transacción |
| VII. Observabilidad | ✅ | Amplía las métricas exigidas con métricas de negocio sin tocar las técnicas |
| VIII. Swagger | ✅ N/A | Sin endpoints nuevos ni modificados |
| IX. Testing | ✅ | Unit del servicio y los mapas, e2e de las series, test de arquitectura sin excepciones nuevas |
| X. Definición de terminado | ✅ | Tests y `nest build` verdes; Swagger/Postman N/A (sin cambios de endpoints) |
| XI. Idioma | ✅ | Identificadores en inglés; `help` de las métricas, README y docs en español |
| XII. Spec-first | ✅ | Spec 031 antes del plan; las desviaciones del plan del equipo quedan decididas en [research.md](research.md) |
| XIII. Performance | ✅ | Sin SLA nuevos ni endpoints; el caché/fallback queda fuera de alcance (no existe todavía) |

**Resultado**: sin violaciones; Complexity Tracking vacío. Re-evaluado tras el diseño (Phase 1): sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/031-business-metrics/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones y desviaciones del plan del equipo
├── data-model.md        # Phase 1: métricas, conjuntos cerrados y tabla sync_last_success
├── quickstart.md        # Phase 1: validación de punta a punta
├── contracts/
│   └── business-metrics.md   # Phase 1: contrato del texto de /metrics
└── tasks.md             # Phase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── shared/observability/
│   │   ├── metrics/business-metrics.ts     # NUEVO: nombres, conjuntos cerrados, buckets, textos HELP, interfaz BusinessMetrics y classifySyncRun
│   │   └── business-audit/business-audit.interceptor.ts  # EDITADO: alimenta business_operations_total
│   ├── services/
│   │   ├── observability/
│   │   │   ├── business-metrics.service.ts    # NUEVO: implementa BusinessMetrics; comparte el Registry; nunca lanza
│   │   │   ├── sync-last-success.service.ts   # NUEVO: escribe la tabla (sólo con success) y siembra el gauge al arrancar
│   │   │   └── metrics.service.ts             # EDITADO: expone el Registry (getter)
│   │   ├── orders/
│   │   │   ├── orders.service.ts              # EDITADO: tokens/volumen tras el commit; rechazos
│   │   │   └── order-rejection-reason.ts      # NUEVO: error de dominio -> motivo (fallback other)
│   │   ├── player-sync/player-sync.service.ts        # EDITADO: corridas, duración, última exitosa
│   │   ├── competition/football-data-sync.service.ts # EDITADO: ídem
│   │   ├── quotation/quotation.service.ts            # EDITADO: recalculateAll(trigger); duración y resultado
│   │   ├── simulation/market-simulation.service.ts   # EDITADO: recálculo simulado como manual
│   │   ├── alerts/quote-recalculated.listener.ts     # EDITADO: alerts_triggered_total
│   │   └── notifications/
│   │       ├── alert-notification.listener.ts        # EDITADO: notifications_created_total{delivery}
│   │       └── notifications.service.ts              # EDITADO: conexiones activas por usuario + gauge SSE
│   ├── controllers/quotation/quotation.controller.ts # EDITADO: pasa trigger 'manual'
│   ├── repositories/sync/                 # NUEVO: entity, mapper y SyncLastSuccessRepository
│   ├── database/migrations/               # NUEVO: CreateSyncLastSuccess
│   └── modules/observability/metrics.module.ts  # EDITADO: provee/exporta BusinessMetricsService (token BUSINESS_METRICS)
├── grafana/dashboards/futval-http-metrics.json  # EDITADO: fila "Negocio"
└── test/observability/business-metrics.e2e-spec.ts  # NUEVO
README.md                                           # EDITADO: lista de métricas de negocio
```

**Structure Decision**: Se sigue la organización por capa de la 029 (`shared/observability/metrics` para constantes e interfaces, `services/observability` para la implementación, `modules/observability` para el cableado). Los módulos que instrumentan (orders, player-sync, competition, quotation, simulation, alerts, notifications) importan `MetricsModule` para inyectar el token `BUSINESS_METRICS`.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
