# Implementation Plan: Alertas de precio por estrategia personal

**Branch**: `feat/alerts` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-player-price-alerts/spec.md`

## Summary

Un usuario autenticado crea alertas de precio (`PriceAlert`) sobre un jugador puntual,
comparadas contra su propia `PlayerQuote`. Cada vez que `QuotationService.recalculateAll`
persiste una `PlayerQuote` nueva, el backend emite un evento de dominio interno
`quote.recalculated` (patrón Observer vía `EventEmitter2`, `@nestjs/event-emitter`). Un
nuevo módulo de alertas escucha ese evento, evalúa las alertas activas del usuario+jugador
y, si corresponde, emite `alert.triggered`. Dos listeners independientes reaccionan a
`alert.triggered`: uno persiste una `Notification` y la empuja por Server-Sent Events si
el usuario está conectado; otro envía un mail (Nodemailer vía `@nestjs-modules/mailer`).
Un fallo del listener de mail se loguea y no afecta al resto. El frontend agrega una
campanita con contador de no leídas en el layout, que carga el listado inicial con
`GET /notifications` y se actualiza en vivo vía SSE.

## Technical Context

**Language/Version**: TypeScript 5.7 (modo `strict`), Node.js 20

**Primary Dependencies**:
- Backend: NestJS 11, TypeORM, `@nestjs/event-emitter` (nuevo), `@nestjs-modules/mailer`
  + Nodemailer (nuevo), `@nestjs/swagger`
- Frontend: React 19, Vite 8, Tailwind CSS 4

**Storage**: PostgreSQL vía TypeORM (tablas nuevas `price_alerts` y `notifications`)

**Testing**: Jest (unit + integración con Testcontainers) en backend; Vitest + React
Testing Library en frontend; tsarch para el test de arquitectura

**Target Platform**: Aplicación web (backend NestJS servido vía HTTP/REST, frontend SPA)

**Project Type**: Web application (monorepo `backend/` + `frontend/`, ya existente)

**Performance Goals**: La evaluación de alertas tras un recálculo no debe degradar
perceptiblemente el tiempo de respuesta de `POST /quotes/recalculate` ya existente
(evaluación en memoria por lote, sin I/O adicional por alerta salvo el guardado batched
de notificaciones)

**Constraints**: Un fallo de envío de email MUST NOT interrumpir el procesamiento del
recálculo ni la persistencia de la notificación ya generada (FR-020); SSE es
unidireccional servidor→cliente, sin reintento si el cliente no está conectado

**Scale/Scope**: Alcance acotado a 2 entidades nuevas, 2 eventos de dominio internos, 2
listeners, ~6 endpoints HTTP nuevos y un componente de UI (campanita + bandeja)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Aplica | Cumplimiento planeado |
|---|---|---|
| I. Arquitectura en capas | Sí | `AlertsController`/`NotificationsController` → `AlertsService`/`NotificationsService` → dominio (`PriceAlert`, `Notification`, evaluación de condición) + `PriceAlertRepository`/`NotificationRepository`. El envío de mail se aísla detrás de un `MailAdapter` (interfaz de dominio propia); el Service de notificaciones no importa Nodemailer directamente. |
| II. Modelo de dominio rico | Sí | La evaluación de la condición ("sube de"/"baja de" un umbral) vive en el dominio `PriceAlert` (método `matches(value)`), no en el listener ni en el Service. |
| III. Cada validación en su nivel | Sí | DTO: forma del request (jugador UUID, condición enum, umbral positivo vía class-validator). Service: el jugador existe, la alerta pertenece al usuario. Dominio: invariantes de `PriceAlert`/`Notification` (umbral positivo, condición válida), lanzando errores propios. |
| IV. Autenticación | Sí | Todos los endpoints de alertas/notificaciones son user-scoped → `JwtAuthGuard` + `@CurrentUser()`, nunca `ApiKeyGuard` (no son operaciones de sistema). |
| V. Auditoría inmutable | No aplica | No es una operación de compra/venta de tokens. |
| VI. Integridad transaccional | Parcial | La persistencia de cada `Notification` ocurre por evento `alert.triggered` individual (no por lote agrupado por recálculo): cada disparo se persiste de forma atómica en sí mismo, pero un recálculo que dispara varias alertas no las persiste como una única unidad todas-o-ninguna. Se acepta así porque cada `Notification` es independiente de las demás (ninguna referencia cruzada entre ellas) y una falla parcial no deja ningún registro a medio escribir, solo a algunas alertas sin notificar — recuperable en el próximo recálculo si la condición sigue cumpliéndose (FR-009). El envío de mail es explícitamente best-effort y fuera de esta unidad (FR-020). |
| VII. Observabilidad | Sí | Logs estructurados en el listener de mail ante fallo (FR-020); el flujo participa del Correlation ID ya propagado por el middleware existente. |
| VIII. Documentación de la API | Sí | Nuevos endpoints documentados con `@nestjs/swagger` desde los DTOs. |
| IX. Testing | Sí | Unit tests de dominio (`PriceAlert.matches`, `Notification`) sin Nest ni DB; integración de Services/Repositories/listeners con Testcontainers; e2e con supertest; componentes de frontend (campanita, bandeja) con Vitest + RTL contra backend real; test de tsarch ya existente cubre las capas nuevas sin cambios. |
| X. Definición de terminado | Sí | Swagger y Postman se actualizan por agregar endpoints; build de ambos paquetes verificado. |
| XI. Idioma | Sí | Identificadores en inglés (`PriceAlert`, `Notification`, `AlertTriggeredEvent`); mensajes de error y nombres de dominio conceptual en español. |
| XII. Spec-first | Sí | Nace de `specs/025-player-price-alerts/spec.md`. |

No hay violaciones que requieran justificación en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/025-player-price-alerts/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── alerts-api.md
│   └── notifications-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── controllers/
│   │   ├── alerts/
│   │   │   ├── alerts.controller.ts
│   │   │   └── dto/
│   │   │       ├── create-price-alert-request.dto.ts
│   │   │       └── price-alert-response.dto.ts
│   │   └── notifications/
│   │       ├── notifications.controller.ts
│   │       ├── notifications-sse.controller.ts
│   │       └── dto/notification-response.dto.ts
│   ├── services/
│   │   ├── alerts/
│   │   │   ├── alerts.service.ts
│   │   │   └── quote-recalculated.listener.ts      # escucha quote.recalculated, emite alert.triggered
│   │   └── notifications/
│   │       ├── notifications.service.ts
│   │       ├── alert-notification.listener.ts       # escucha alert.triggered → persiste Notification + push SSE
│   │       └── alert-mail.listener.ts                # escucha alert.triggered → envía mail (independiente)
│   ├── domain/
│   │   ├── alerts/
│   │   │   ├── price-alert.ts
│   │   │   ├── alert-condition.ts                    # enum: PRICE_ABOVE | PRICE_BELOW
│   │   │   ├── events/quote-recalculated.event.ts
│   │   │   ├── events/alert-triggered.event.ts
│   │   │   └── errors/
│   │   │       ├── alert-not-found.error.ts
│   │   │       └── invalid-alert-condition.error.ts
│   │   └── notifications/
│   │       └── notification.ts
│   ├── repositories/
│   │   ├── alerts/
│   │   │   ├── price-alert.repository.ts             # interfaz de dominio
│   │   │   ├── typeorm-price-alert.repository.ts
│   │   │   ├── entities/price-alert.entity.ts
│   │   │   └── price-alert.mapper.ts
│   │   └── notifications/
│   │       ├── notification.repository.ts
│   │       ├── typeorm-notification.repository.ts
│   │       ├── entities/notification.entity.ts
│   │       └── notification.mapper.ts
│   ├── adapters/
│   │   └── mail/
│   │       ├── mail.adapter.ts                        # interfaz de dominio (sendAlertTriggeredMail)
│   │       └── nodemailer-mail.adapter.ts
│   └── modules/
│       ├── alerts/alerts.module.ts
│       └── notifications/notifications.module.ts
└── test/ (e2e con supertest, convención existente)

frontend/
├── src/
│   ├── service/
│   │   ├── alertsService.ts
│   │   └── notificationsService.ts
│   ├── hooks/
│   │   ├── usePlayerAlerts.ts
│   │   └── useNotifications.ts                        # listado inicial + suscripción SSE
│   ├── contexts/
│   │   ├── notifications-context.ts
│   │   └── NotificationsContext.tsx
│   ├── components/
│   │   ├── alerts/
│   │   │   ├── CreateAlertForm.tsx
│   │   │   └── PlayerAlertsList.tsx
│   │   └── notifications/
│   │       ├── NotificationBell.tsx
│   │       └── NotificationTray.tsx
│   └── layout/AppLayout.tsx                            # se integra la campanita existente del header
```

**Structure Decision**: Se reutiliza la estructura Web application ya presente en el
repo (`backend/` NestJS en capas + `frontend/` React SPA). Dentro de `backend/src/` se
agregan dos verticales nuevas (`alerts`, `notifications`) siguiendo exactamente la
convención de carpetas por capa (`controllers/`, `services/`, `domain/`,
`repositories/`, `modules/`) que ya usan `player`, `quotation`, `portfolio`, etc. El
envío de mail se aísla en `adapters/mail/`, igual que los demás accesos a sistemas
externos (`adapters/player-sync/`). El frontend sigue el mismo patrón por tipo de
archivo (`service/`, `hooks/`, `contexts/`, `components/`) ya usado por `portfolio` y
`auth`.

## Complexity Tracking

*Sin violaciones de la Constitution Check que requieran justificación.*
