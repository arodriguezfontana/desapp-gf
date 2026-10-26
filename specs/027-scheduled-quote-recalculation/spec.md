# Feature Specification: Recálculo semanal automático de cotizaciones

**Feature Branch**: `refactor/orders-logic`

**Created**: 2026-10-26

**Status**: Implemented

**Input**: User description: "El recálculo de cotizaciones tiene que correr automáticamente con un cron semanal. Hoy solo lo dispara un administrador a mano con POST /quotes/recalculate, porque la spec 019 discontinuó el job semanal de la spec 012."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Las cotizaciones se actualizan solas cada semana (Priority: P1)

Una vez por semana el sistema recalcula las cotizaciones de todos los usuarios con los jugadores y métricas que hay en ese momento, sin que nadie lo pida. Así los jugadores nuevos y los que cambiaron de métricas tras la sincronización aparecen en el ranking y en el historial.

**Why this priority**: sin esto, después de cada sincronización de jugadores las cotizaciones guardadas quedan viejas (o inexistentes para jugadores nuevos) hasta que un administrador recuerde ejecutar el recálculo.

**Independent Test**: se puede verificar sin esperar una semana: el método del job se prueba llamándolo directamente (debe invocar `recalculateAll`) y la configuración del `@Cron` se verifica leyendo su metadata.

**Acceptance Scenarios**:

1. **Given** el servidor en ejecución, **When** llega el domingo a las 03:00, **Then** se ejecuta el mismo recálculo global que dispara `POST /quotes/recalculate`.
2. **Given** que ya hay un recálculo en curso (disparado a mano por un administrador), **When** llega el horario del cron, **Then** el job se saltea con una advertencia en el log y no lanza ninguna excepción.
3. **Given** un error inesperado durante el recálculo, **When** corre el job, **Then** el error se registra en el log y el scheduler no se cae.

### User Story 2 - El recálculo manual sigue funcionando (Priority: P2)

El administrador puede seguir disparando el recálculo con `POST /quotes/recalculate`, por ejemplo para forzarlo después de una sincronización puntual.

**Acceptance Scenarios**:

1. **Given** una API key de administrador, **When** llama a `POST /quotes/recalculate`, **Then** se ejecuta el recálculo como hasta ahora (200, 401, 403 o 409 según corresponda).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ejecutar `QuotationService.recalculateAll()` automáticamente una vez por semana, los domingos a las 03:00.
- **FR-002**: El job MUST usar el mismo método y el mismo lock a nivel sistema que el endpoint manual, sin duplicar lógica.
- **FR-003**: Si hay un recálculo en curso, el job MUST saltearse (advertencia en el log) sin lanzar `RecalculationInProgressError`.
- **FR-004**: Un error inesperado MUST registrarse y NO propagarse al scheduler.
- **FR-005**: El `@Cron` MUST declararse con `waitForCompletion: true` para evitar ejecuciones solapadas del propio job.
- **FR-006**: `POST /quotes/recalculate` MUST seguir funcionando sin cambios (Principio X: no cambia ningún endpoint, así que Swagger y Postman no requieren actualización).

### Key Entities

- **QuotationJob**: servicio con el `@Cron` semanal; delega en `QuotationService.recalculateAll()`.

## Decisions

### DD-001: El cron vuelve a existir, ahora como recálculo global

La spec 019 (DD-003) discontinuó el cron semanal porque, con estrategias por usuario, "ejecutar un job automático tendría que recalcular por separado para cada usuario registrado, lo cual escala mal". Desde entonces (commit `5966b88`) el recálculo es global y de administrador, y ya itera por usuario con la estrategia seleccionada de cada uno. Esa misma operación es la que ahora se programa; el argumento de escala no cambió, pero se prefiere el costo de un recálculo semanal a que las cotizaciones queden desactualizadas.

### DD-002: Domingos a las 03:00 y no a las 00:00

Los jobs de sincronización de jugadores y de partidos corren los domingos a las 00:00 (`CronExpression.EVERY_WEEK`). Si el recálculo corriera a la misma hora, podría valuar con las métricas de la semana anterior antes de que termine la sincronización. Se programa unas horas después. El margen de 3 horas es una estimación: no hay garantía de que la sincronización haya terminado.

### DD-003: Un job propio en lugar de un `@Cron` dentro de `QuotationService`

`QuotationJob` mantiene la planificación separada de la lógica de negocio, igual que en la spec 012, y deja a `QuotationService` testeable sin el scheduler.

## Assumptions

- La zona horaria del cron es la del servidor.
- Con varias instancias del backend el lock en memoria no evitaría ejecuciones simultáneas (fuera de alcance).
- Fuera de alcance: disparar el recálculo al terminar la sincronización de jugadores, y una política de retención del historial de cotizaciones.

## Success Criteria

- **SC-001**: El job invoca `recalculateAll` y nunca lanza, ni siquiera ante un recálculo en curso o un error inesperado.
- **SC-002**: La aplicación arranca con el job registrado y los tests e2e de cotización siguen en verde.
