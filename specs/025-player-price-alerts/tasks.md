---

description: "Task list for Alertas de precio por estrategia personal"

---

# Tasks: Alertas de precio por estrategia personal

> **Actualización (2026-10-27):** se eliminó el envío de emails de alertas (historia 4, FR-019 a FR-021 en su parte de email). El aviso queda solo en la bandeja de notificaciones, con push en vivo por SSE. Los módulos de mail, el adaptador de Nodemailer y las variables `MAIL_*` ya no existen; las referencias al email que siguen en este documento son registro histórico de la decisión original.

**Input**: Design documents from `specs/025-player-price-alerts/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/alerts-api.md](./contracts/alerts-api.md), [contracts/notifications-api.md](./contracts/notifications-api.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios — la constitución del proyecto (Principio IX) exige
unit tests de dominio sin Nest/DB, integración de Services/Repositories con
Testcontainers, e2e con supertest, y tests de componentes de frontend con Vitest + RTL
contra backend real. No son opcionales en este proyecto.

**Organization**: Tareas agrupadas por user story de `spec.md` (US1–US4), en orden de
prioridad (US1, US2, US3 son P1; US4 es P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 (crear alerta), US2 (listar/cancelar), US3 (bandeja + push en vivo), US4 (email)
- Rutas de archivo exactas en cada descripción, siguiendo la estructura de `plan.md`

## Path Conventions

Monorepo web app ya existente: `backend/src/` (NestJS en capas) y `frontend/src/`
(React). Ver "Project Structure" en [plan.md](./plan.md) para el árbol completo.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencias nuevas y configuración base, sin lógica de negocio todavía

- [X] T001 Agregar `@nestjs/event-emitter` a `backend/package.json` y registrar `EventEmitterModule.forRoot()` en `backend/src/app.module.ts`
- [X] T002 Agregar `@nestjs-modules/mailer` y `nodemailer` (+ `@types/nodemailer`) a `backend/package.json`
- [X] T003 [P] Agregar variables `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` a `backend/.env.example` (sin valores reales) con comentario explicando el proveedor de demo (Gmail app password o Resend vía SMTP)
- [X] T004 [P] Confirmar en `.gitignore` y `backend/.gitignore` que `.env` real sigue excluido (verificación, sin cambios si ya está cubierto)
- [X] T005 [P] Crear migración TypeORM `CreatePriceAlerts` en `backend/src/database/migrations/` con tabla `price_alerts` (id, user_id, player_id, condition, target_value DECIMAL(10,2), status, created_at, cancelled_at nullable)
- [X] T006 [P] Crear migración TypeORM `CreateNotifications` en `backend/src/database/migrations/` con tabla `notifications` (id, user_id, alert_id, player_id, condition, triggered_value DECIMAL(10,2), created_at, read boolean default false)

**Checkpoint**: Dependencias instaladas, event emitter registrado, esquema de base listo.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Dominio base, eventos, wiring de `quote.recalculated`, y el `MailAdapter` —
todo lo que todas las user stories necesitan antes de poder implementarse.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta terminar esta fase.

- [X] T007 [P] Crear enum `AlertCondition` (`PRICE_ABOVE` \| `PRICE_BELOW`) en `backend/src/domain/alerts/alert-condition.ts`
- [X] T008 [P] Crear errores de dominio `InvalidAlertThresholdError`, `InvalidAlertConditionError` en `backend/src/domain/alerts/errors/` y `AlertNotFoundError` en `backend/src/domain/alerts/errors/alert-not-found.error.ts`
- [X] T009 [US-shared] Crear clase de dominio `PriceAlert` (id, userId, playerId, condition, targetValue, status, createdAt, cancelledAt; invariantes de umbral positivo y condición válida en el constructor; métodos `matches(value)`, `cancel()`) en `backend/src/domain/alerts/price-alert.ts` (depende de T007, T008)
- [X] T010 [P] Unit test de `PriceAlert` (umbral inválido, condición inválida, `matches` para ambas condiciones, `cancel` idempotente) sin Nest ni DB en `backend/src/domain/alerts/price-alert.spec.ts`
- [X] T011 [P] Crear clase de dominio `Notification` (id, userId, alertId, playerId, condition, triggeredValue, createdAt, read; método `markAsRead()`) en `backend/src/domain/notifications/notification.ts`
- [X] T012 [P] Unit test de `Notification` (`markAsRead` idempotente, estado inicial `read = false`) en `backend/src/domain/notifications/notification.spec.ts`
- [X] T013 [P] Crear `QuoteRecalculatedEvent` (userId, playerId, value, occurredAt) en `backend/src/domain/alerts/events/quote-recalculated.event.ts`
- [X] T014 [P] Crear `AlertTriggeredEvent` (alertId, userId, playerId, condition, triggeredValue, occurredAt) en `backend/src/domain/alerts/events/alert-triggered.event.ts`
- [X] T015 Modificar `backend/src/services/quotation/quotation.service.ts` (`recalculateAll`) para emitir `quote.recalculated` (vía `EventEmitter2` inyectado) una vez por cada `PlayerQuote` nueva efectivamente persistida (no por las salteadas en `skipped`)
- [X] T016 Actualizar `backend/src/services/quotation/__tests__/quotation.service.spec.ts` y `quotation.service.integration.spec.ts` para verificar que se emite `quote.recalculated` con el payload correcto por cada cotización nueva, y que no se emite por las salteadas
- [X] T017 [P] Crear interfaz de dominio `MailAdapter` (`sendAlertTriggeredMail(to: string, payload: { playerId; condition; triggeredValue; occurredAt }): Promise<void>`) en `backend/src/adapters/mail/mail.adapter.ts`
- [X] T018 Implementar `NodemailerMailAdapter` (usa `@nestjs-modules/mailer`/Nodemailer, configurado por `MAIL_*` env vars) en `backend/src/adapters/mail/nodemailer-mail.adapter.ts` (depende de T002, T017)
- [X] T019 [P] Unit test de `NodemailerMailAdapter` con el transporte de Nodemailer mockeado (verifica payload del mail armado correctamente; no abre conexión SMTP real) en `backend/src/adapters/mail/nodemailer-mail.adapter.spec.ts`

**Checkpoint**: Dominio base, eventos y adapter de mail listos; `recalculateAll` ya emite
`quote.recalculated`. Las user stories pueden empezar.

---

## Phase 3: User Story 1 - Crear una alerta de precio sobre un jugador (Priority: P1) 🎯 MVP

**Goal**: Un usuario autenticado puede crear una `PriceAlert` válida sobre un jugador
existente, con validación completa de jugador/umbral/condición.

**Independent Test**: `POST /alerts` con un jugador existente, condición y umbral
válidos devuelve `201` con la alerta en estado `ACTIVE`; variantes inválidas devuelven
`400`/`404`, verificable sin que exista aún ningún recálculo ni notificación.

### Tests for User Story 1 ⚠️

- [X] T020 [P] [US1] Integration test de `PriceAlertRepository`/`TypeormPriceAlertRepository` (crear, buscar por id, persistencia de `DECIMAL(10,2)`) contra Testcontainers en `backend/src/repositories/alerts/__tests__/typeorm-price-alert.repository.integration.spec.ts`
- [X] T021 [P] [US1] Integration test de `AlertsService.create` (jugador inexistente → `PlayerNotFoundError`; umbral/condición inválidos delegados al dominio; múltiples alertas activas sobre el mismo jugador conviven) contra Testcontainers en `backend/src/services/alerts/__tests__/alerts.service.integration.spec.ts`
- [X] T022 [P] [US1] E2E test de `POST /alerts` (201 caso feliz, 400 umbral negativo, 400 condición inválida, 404 jugador inexistente, 401 sin JWT) con supertest en `backend/test/alerts/create-alert.e2e-spec.ts`

### Implementation for User Story 1

- [X] T023 [P] [US1] Crear entidad TypeORM `PriceAlertEntity` en `backend/src/repositories/alerts/entities/price-alert.entity.ts` (mapea la migración T005; `target_value` como `decimal` con `precision: 10, scale: 2`)
- [X] T024 [US1] Crear `PriceAlertMapper` (dominio ↔ entidad) en `backend/src/repositories/alerts/price-alert.mapper.ts` (depende de T009, T023)
- [X] T025 [US1] Definir interfaz `PriceAlertRepository` en `backend/src/repositories/alerts/price-alert.repository.ts` e implementarla en `TypeormPriceAlertRepository` (`backend/src/repositories/alerts/typeorm-price-alert.repository.ts`) con métodos `save`, `findById`, `findActiveByUserIdAndPlayerId`, `findAllByUserId` (depende de T024)
- [X] T026 [P] [US1] Crear constantes de inyección en `backend/src/modules/alerts/alerts.constants.ts` (`PRICE_ALERT_REPOSITORY`)
- [X] T027 [US1] Implementar `AlertsService.create(userId, playerId, condition, targetValue)` en `backend/src/services/alerts/alerts.service.ts` (valida jugador vía `PlayerRepository`, construye `PriceAlert` de dominio, persiste) (depende de T009, T025, T026)
- [X] T028 [P] [US1] Crear `CreatePriceAlertRequestDto` (class-validator: `playerId` UUID, `condition` enum, `targetValue` número positivo) en `backend/src/controllers/alerts/dto/create-price-alert-request.dto.ts`
- [X] T029 [P] [US1] Crear `PriceAlertResponseDto` (+ `fromDomain`) en `backend/src/controllers/alerts/dto/price-alert-response.dto.ts`
- [X] T030 [US1] Implementar `AlertsController` (`POST /alerts`, `JwtAuthGuard` + `@CurrentUser()`, Swagger `@ApiTags('alerts')`) en `backend/src/controllers/alerts/alerts.controller.ts` (depende de T027, T028, T029)
- [X] T031 [US1] Crear `AlertsModule` (registra controller, service, repository provider) en `backend/src/modules/alerts/alerts.module.ts` e importarlo en `backend/src/app.module.ts`

**Checkpoint**: User Story 1 funcional y testeable de forma independiente — se pueden
crear alertas válidas y las inválidas se rechazan correctamente.

---

## Phase 4: User Story 2 - Consultar y cancelar las propias alertas (Priority: P1)

**Goal**: El usuario lista únicamente sus propias alertas y puede cancelar una propia en
cualquier momento; nunca ve ni cancela alertas ajenas.

**Independent Test**: `GET /alerts` devuelve solo las alertas del usuario autenticado;
`DELETE /alerts/:id` sobre una alerta propia la pasa a `CANCELLED` y deja de evaluarse;
sobre una alerta ajena devuelve `404`.

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] Integration test de `AlertsService.listOwn` y `AlertsService.cancel` (aislamiento entre usuarios, 404 al cancelar alerta ajena o inexistente, cancelar dos veces es idempotente) contra Testcontainers en `backend/src/services/alerts/__tests__/alerts.service.integration.spec.ts` (extiende el archivo de T021)
- [X] T033 [P] [US2] E2E test de `GET /alerts` y `DELETE /alerts/:id` (listado propio, 404 sobre alerta de otro usuario, 204 al cancelar propia, 401 sin JWT) con supertest en `backend/test/alerts/manage-alerts.e2e-spec.ts`

### Implementation for User Story 2

- [X] T034 [US2] Agregar método `cancel(id)` (actualiza `status`/`cancelledAt`) a `TypeormPriceAlertRepository` en `backend/src/repositories/alerts/typeorm-price-alert.repository.ts`
- [X] T035 [US2] Implementar `AlertsService.listOwn(userId)` y `AlertsService.cancel(userId, alertId)` (verifica ownership antes de cancelar, lanza `AlertNotFoundError` si no existe o no es propia) en `backend/src/services/alerts/alerts.service.ts` (depende de T034)
- [X] T036 [US2] Agregar `GET /alerts` y `DELETE /alerts/:id` a `AlertsController` en `backend/src/controllers/alerts/alerts.controller.ts` (depende de T035)
- [X] T037 [P] [US2] Componente frontend `PlayerAlertsList` (lista alertas propias, botón cancelar) en `frontend/src/components/alerts/PlayerAlertsList.tsx` + hook `usePlayerAlerts` en `frontend/src/hooks/usePlayerAlerts.ts` + cliente `alertsService` en `frontend/src/service/alertsService.ts`
- [X] T038 [P] [US2] Componente frontend `CreateAlertForm` (jugador, condición, umbral; usa `alertsService.create`) en `frontend/src/components/alerts/CreateAlertForm.tsx`
- [X] T039 [P] [US2] Vitest + RTL del cliente `alertsService` mockeando `fetch` (nunca mockeando el propio cliente) en `frontend/src/service/alertsService.spec.ts`
- [X] T040 [P] [US2] Vitest + RTL de `PlayerAlertsList` y `CreateAlertForm` contra backend real (Testcontainers) en `frontend/src/components/alerts/PlayerAlertsList.spec.tsx` y `CreateAlertForm.spec.tsx`

**Checkpoint**: User Stories 1 y 2 funcionan juntas — crear, listar y cancelar alertas
propias, con aislamiento estricto entre usuarios.

---

## Phase 5: User Story 3 - Notificación en bandeja con push en vivo (Priority: P1)

**Goal**: Al dispararse una alerta por un recálculo, se genera una `Notification`
visible en `GET /notifications`, con contador de no leídas, marcado de lectura, y
actualización en vivo vía SSE si el usuario está conectado.

**Independent Test**: Tras un recálculo que genera una `PlayerQuote` que cumple la
condición de una alerta activa, aparece una notificación nueva en `GET /notifications`
(con los datos correctos) y, si hay una conexión SSE abierta para ese usuario, llega el
mismo evento por el stream sin necesidad de volver a pedir el listado.

### Tests for User Story 3 ⚠️

- [X] T041 [P] [US3] Unit test de `QuoteRecalculatedListener` (evalúa `matches` de las alertas activas del usuario+jugador del evento; emite un `AlertTriggeredEvent` por cada alerta que cumple; no emite nada si ninguna cumple; emite varios si hay varias alertas distintas sobre el mismo jugador; verifica que una alerta sigue activa y vuelve a emitir `AlertTriggeredEvent` en una segunda invocación del listener con un `QuoteRecalculatedEvent` posterior que todavía cumple la condición, FR-009; verifica que una alerta en estado `CANCELLED` no emite `AlertTriggeredEvent` aunque su `matches` devolvería `true`, FR-008) con dobles del repositorio, sin Nest ni DB, en `backend/src/services/alerts/__tests__/quote-recalculated.listener.spec.ts`
- [X] T042 [P] [US3] Integration test de `NotificationsService`/`TypeormNotificationRepository` (persistencia, orden por `createdAt` descendente, `markAsRead`, aislamiento por usuario) contra Testcontainers en `backend/src/services/notifications/__tests__/notifications.service.integration.spec.ts`
- [X] T043 [P] [US3] Unit test de `AlertNotificationListener` (persiste `Notification` a partir de `AlertTriggeredEvent`, empuja al stream SSE del usuario si está suscripto) con dobles, sin Nest ni DB, en `backend/src/services/notifications/__tests__/alert-notification.listener.spec.ts`
- [X] T044 [P] [US3] E2E test del flujo completo recálculo → `quote.recalculated` → `alert.triggered` → `Notification` persistida, usando `POST /quotes/recalculate` (API key admin) seguido de `GET /notifications` con supertest en `backend/test/alerts/alert-triggers-notification.e2e-spec.ts`
- [X] T045 [P] [US3] E2E test de `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` (orden, filtro `unreadOnly`, 404 sobre notificación ajena, 401 sin JWT) con supertest en `backend/test/notifications/manage-notifications.e2e-spec.ts`

### Implementation for User Story 3

- [X] T046 [P] [US3] Crear entidad TypeORM `NotificationEntity` en `backend/src/repositories/notifications/entities/notification.entity.ts` (mapea la migración T006)
- [X] T047 [US3] Crear `NotificationMapper` en `backend/src/repositories/notifications/notification.mapper.ts` (depende de T011, T046)
- [X] T048 [US3] Definir interfaz `NotificationRepository` e implementar `TypeormNotificationRepository` (`save`, `findAllByUserId` ordenado desc, `findById`, `markAsRead`, `markAllAsReadByUserId`) en `backend/src/repositories/notifications/notification.repository.ts` y `typeorm-notification.repository.ts` (depende de T047)
- [X] T049 [P] [US3] Crear constantes de inyección en `backend/src/modules/notifications/notifications.constants.ts` (`NOTIFICATION_REPOSITORY`)
- [X] T050 [US3] Implementar `QuoteRecalculatedListener` (`@OnEvent('quote.recalculated')`, busca alertas activas del usuario+jugador vía `PriceAlertRepository`, evalúa `matches`, emite `alert.triggered` por cada una que cumple) en `backend/src/services/alerts/quote-recalculated.listener.ts`, registrado en `AlertsModule` (depende de T009, T013, T014, T025)
- [X] T051 [US3] Implementar `NotificationsService` (gestión del `Subject`/stream por usuario conectado para SSE, `listOwn`, `markAsRead`, `markAllAsRead`, método interno `pushToStream(userId, notification)`) en `backend/src/services/notifications/notifications.service.ts` (depende de T048, T049)
- [X] T052 [US3] Implementar `AlertNotificationListener` (`@OnEvent('alert.triggered')`, construye y persiste `Notification`, llama `NotificationsService.pushToStream`) en `backend/src/services/notifications/alert-notification.listener.ts` (depende de T051)
- [X] T053 [P] [US3] Crear `NotificationResponseDto` (+ `fromDomain`) en `backend/src/controllers/notifications/dto/notification-response.dto.ts`
- [X] T054 [US3] Implementar `NotificationsController` (`GET /notifications` con `unreadOnly` opcional, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `JwtAuthGuard`) en `backend/src/controllers/notifications/notifications.controller.ts` (depende de T051, T053)
- [X] T055 [US3] Implementar `NotificationsSseController` (`GET /notifications/stream`, `@Sse()`, autenticación por JWT en query param) en `backend/src/controllers/notifications/notifications-sse.controller.ts` (depende de T051)
- [X] T055a [US3] Excluir el query string de `/notifications/stream` del logging de requests (middleware de Correlation ID / logger HTTP existente) en `backend/src/shared/` (o el middleware de logging correspondiente), para no loguear el JWT pasado por query param (depende de T055)
- [X] T056 [US3] Crear `NotificationsModule` (registra ambos controllers, service, repository provider, `AlertNotificationListener`) en `backend/src/modules/notifications/notifications.module.ts` e importarlo en `backend/src/app.module.ts`
- [X] T057 [P] [US3] Cliente `notificationsService` (fetch de `/notifications`, PATCH de lectura, apertura de `EventSource` hacia `/notifications/stream`) en `frontend/src/service/notificationsService.ts`
- [X] T058 [P] [US3] `NotificationsContext`/`notifications-context` (estado global de notificaciones y contador de no leídas) en `frontend/src/contexts/NotificationsContext.tsx` y `frontend/src/contexts/notifications-context.ts`, con hook `useNotifications` en `frontend/src/hooks/useNotifications.ts` (carga inicial + suscripción SSE)
- [X] T059 [P] [US3] Componentes `NotificationBell` (contador de no leídas) y `NotificationTray` (lista ordenada, marcar como leída) en `frontend/src/components/notifications/NotificationBell.tsx` y `NotificationTray.tsx`
- [X] T060 [US3] Integrar `NotificationBell` en `frontend/src/layout/AppLayout.tsx` (depende de T058, T059)
- [X] T061 [P] [US3] Vitest + RTL de `notificationsService` mockeando `fetch`/`EventSource` en `frontend/src/service/notificationsService.spec.ts`
- [X] T062 [P] [US3] Vitest + RTL de `useNotifications` en `frontend/src/hooks/useNotifications.spec.ts` y de `NotificationBell`/`NotificationTray` contra backend real (Testcontainers) en `frontend/src/components/notifications/NotificationBell.spec.tsx` y `NotificationTray.spec.tsx`

**Checkpoint**: User Stories 1, 2 y 3 funcionan juntas — el flujo completo de alerta →
recálculo → notificación en bandeja con push en vivo queda demostrable de punta a
punta (MVP completo del lado de producto, sin email todavía).

---

## Phase 6: User Story 4 - Recibir el aviso también por email (Priority: P2)

**Goal**: Cada disparo de alerta envía además un email a la casilla registrada del
usuario, de forma independiente de la bandeja; un fallo de envío no afecta a la
notificación ya persistida ni al resto del recálculo.

**Independent Test**: Tras un disparo de alerta, se envía un email con la misma
información de la notificación; si el envío falla (credenciales SMTP inválidas en un
entorno de test), la notificación en bandeja generada por el otro listener sigue
intacta y el log registra el fallo.

### Tests for User Story 4 ⚠️

- [X] T063 [P] [US4] Unit test de `AlertMailListener` (arma el payload del mail desde `AlertTriggeredEvent`, llama a `MailAdapter.sendAlertTriggeredMail`, captura y loguea una excepción del adapter sin relanzar) con un doble de `MailAdapter`, sin Nest ni DB, en `backend/src/services/notifications/__tests__/alert-mail.listener.spec.ts`
- [X] T064 [P] [US4] Integration test que confirma que un `AlertMailListener` que falla (mail adapter lanza) no impide que `AlertNotificationListener` persista la `Notification` para el mismo `AlertTriggeredEvent` (ambos listeners corren de forma independiente) contra Testcontainers en `backend/src/services/notifications/__tests__/alert-triggered-listeners.integration.spec.ts`

### Implementation for User Story 4

- [X] T065 [US4] Implementar `AlertMailListener` (`@OnEvent('alert.triggered')`, resuelve el email del usuario vía el repositorio de usuarios existente, llama `MailAdapter.sendAlertTriggeredMail`, try/catch con `Logger.error` en caso de fallo, sin relanzar) en `backend/src/services/notifications/alert-mail.listener.ts` (depende de T017, T018)
- [X] T066 [US4] Registrar `AlertMailListener` y el `MailModule`/`NodemailerMailAdapter` en `backend/src/modules/notifications/notifications.module.ts` (depende de T065)

**Checkpoint**: Las cuatro user stories funcionan juntas — el flujo completo de la
spec (crear, listar/cancelar, notificación en bandeja con push, y email) queda
implementado y testeado de punta a punta.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras transversales y cierre de la Definición de Terminado (Principio X)

- [X] T067 [P] Verificar que el test de arquitectura tsarch existente sigue pasando con los módulos nuevos (`alerts`, `notifications`, `adapters/mail`) respetando el sentido único de capas, sin cambios de código salvo que detecte una violación real
- [X] T068 [P] Actualizar la documentación Swagger (`@nestjs/swagger`) verificando que los endpoints nuevos (`/alerts`, `/notifications`, `/notifications/stream`) aparecen correctamente documentados desde los DTOs
- [X] T069 [P] Actualizar la colección de Postman del proyecto con los endpoints nuevos de alerts y notifications
- [X] T070 Verificar `nest build` (backend) y `vite build` (frontend) sin errores
- [X] T071 Ejecutar manualmente los 3 escenarios de [quickstart.md](./quickstart.md) de punta a punta contra un entorno local levantado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todas las user stories
- **User Story 1 (Phase 3)**: Depende de Foundational
- **User Story 2 (Phase 4)**: Depende de Foundational; reutiliza el repositorio/service creados en US1 (no bloquea a US1, pero en la práctica se implementa después porque extiende los mismos archivos)
- **User Story 3 (Phase 5)**: Depende de Foundational y de que existan `PriceAlert`/`AlertsService` de US1 (para que `QuoteRecalculatedListener` tenga alertas que evaluar); no depende funcionalmente de US2
- **User Story 4 (Phase 6)**: Depende de Foundational (T017, T018 — `MailAdapter`) y de que exista `AlertTriggeredEvent` emitido por US3 (Phase 5)
- **Polish (Phase 7)**: Depende de que todas las user stories deseadas estén completas

### User Story Dependencies

- **US1 (P1)**: Puede empezar tras Foundational — sin dependencia de otras stories
- **US2 (P1)**: Puede empezar tras Foundational, pero extiende los mismos archivos de repositorio/service/controller creados en US1 — en la práctica se secuencia después de US1
- **US3 (P1)**: Puede empezar tras Foundational; necesita que `PriceAlert`/`AlertsService.create` (US1) ya existan para tener alertas que disparar en las pruebas end-to-end, pero su implementación (listeners, `NotificationsModule`, SSE) es independiente del código de US2
- **US4 (P2)**: Depende de que `AlertTriggeredEvent` ya se esté emitiendo (US3); es el único punto de integración entre stories, y es intencional (dos listeners independientes del mismo evento)

### Within Each User Story

- Tests antes de la implementación correspondiente (deben fallar primero)
- Entidades/mappers antes de repositorios
- Repositorios antes de services
- Services antes de controllers
- Backend antes del cliente/hook/componente de frontend que lo consume

### Parallel Opportunities

- Todas las tareas [P] de Setup (T003–T006) en paralelo
- Dentro de Foundational: T007, T008, T010–T014, T017, T019 en paralelo (archivos distintos); T009, T015, T018 tienen dependencias directas y van después
- Una vez completado Foundational, US1 y la preparación de tests de US3 (T041, que solo necesita dobles) pueden avanzar en paralelo si hay más de un desarrollador
- Dentro de cada story, todos los tests marcados [P] en paralelo entre sí; todos los componentes de frontend marcados [P] en paralelo entre sí

---

## Parallel Example: User Story 1

```bash
# Tests de User Story 1 en paralelo:
Task: "Integration test de PriceAlertRepository en backend/src/repositories/alerts/__tests__/typeorm-price-alert.repository.integration.spec.ts"
Task: "Integration test de AlertsService.create en backend/src/services/alerts/__tests__/alerts.service.integration.spec.ts"
Task: "E2E test de POST /alerts en backend/test/alerts/create-alert.e2e-spec.ts"

# DTOs de User Story 1 en paralelo:
Task: "CreatePriceAlertRequestDto en backend/src/controllers/alerts/dto/create-price-alert-request.dto.ts"
Task: "PriceAlertResponseDto en backend/src/controllers/alerts/dto/price-alert-response.dto.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (crítico — bloquea todas las stories)
3. Completar Phase 3: User Story 1
4. **DETENER Y VALIDAR**: probar la creación de alertas de forma independiente
5. Demo si está listo

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 (crear alerta) → probar independiente → demo
3. US2 (listar/cancelar) → probar independiente → demo (control total sobre las alertas propias)
4. US3 (notificación en bandeja + push) → probar independiente → demo (**MVP de producto completo**: el usuario crea, controla, y se entera de sus alertas sin salir de la app)
5. US4 (email) → probar independiente → demo (canal complementario)
6. Cada story agrega valor sin romper las anteriores

### Parallel Team Strategy

Con más de un desarrollador, tras completar Foundational:

- Developer A: US1 → US2 (mismo área de código, backend de alerts)
- Developer B: US3 (backend de notifications + SSE) en paralelo, usando dobles de `PriceAlertRepository` hasta que US1 esté listo para la integración end-to-end
- Developer C: US4 (`AlertMailListener`) y el frontend de notificaciones (T057–T062) una vez que el contrato de `AlertTriggeredEvent` esté estable

---

## Notes

- [P] = archivos distintos, sin dependencias entre sí
- [Story] mapea cada tarea a su user story para trazabilidad
- Los tests deben fallar antes de implementar (TDD, exigido por Principio IX de la constitución)
- Ningún test existente se modifica ni se borra para hacerlo pasar sin permiso explícito
- Confirmar cada checkpoint de story antes de avanzar a la siguiente
- Evitar: tareas vagas, conflictos de archivo entre tareas [P], dependencias cruzadas entre stories que rompan su independencia (salvo la dependencia intencional US4 → evento de US3)
