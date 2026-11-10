# Implementation Plan: Health check del backend

**Branch**: `027-health-check` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/027-health-check/spec.md` + plan técnico aportado por el equipo (Terminus + `TypeOrmHealthIndicator`), validado contra el código en [research.md](research.md).

## Summary

Reemplazar el `GET /health` actual (que devuelve siempre `"ok"` sin chequear nada) por uno que
verifica la conexión a PostgreSQL con `@nestjs/terminus` (`TypeOrmHealthIndicator.pingCheck('database')`)
y responde 200 `{status:"ok"}` o 503 `{status:"error"}` con el detalle `up`/`down` por componente.
Sigue siendo `@Public()`. No se chequean Football-Data ni WhoScored.

El plan del equipo se adopta con **cinco ajustes** que salieron de verificarlo contra el código
(detalle y evidencia en `research.md`):

1. **Versión**: `@nestjs/terminus@^11.1.1`, no la última. La 12.x es ESM-only (`"type": "module"`) y el backend es CommonJS/ts-jest.
2. **Instalador**: `pnpm add` (el repo usa `pnpm-lock.yaml`), no `npm install`.
3. **503 con cuerpo**: el `AllExceptionsFilter` global reescribe cualquier `HttpException` a `{statusCode, error, message, ...}` y descartaría `status`/`details`. Terminus lanza `ServiceUnavailableException(result)`, así que "503 automático" **no preserva el cuerpo** en esta app. El service atrapa esa excepción y devuelve el resultado; el controller fija el status. El filtro no se toca.
4. **Ubicación**: capas del repo (`controllers/health/`, `services/health/`, `modules/health/`) en vez de una carpeta `health/` suelta, que escaparía de las reglas de capas (Principio I) y del test tsarch.
5. **Tests**: se testea también el caso 503 (no sólo el 200). Lo exigen FR-003/FR-008/FR-009, SC-001 y el Principio IX (casos borde); además esa ruta atraviesa código propio (el manejo del filtro), no sólo Terminus.

Además hay que **quitar** `getHealth` de `AppController`/`AppService` (dos handlers para `GET /health` chocan) y sus tests asociados — ver "Tests existentes afectados".

## Technical Context

**Language/Version**: TypeScript 5.7 (`strict`), Node.js 20, NestJS 11

**Primary Dependencies**: `@nestjs/terminus@^11.1.1` (nueva); ya presentes: `@nestjs/typeorm`, `typeorm` 1.1.x, `@nestjs/swagger`

**Storage**: PostgreSQL vía TypeORM (sólo lectura: `SELECT 1`). Sin migraciones, sin tablas nuevas

**Testing**: Jest (unit con mocks de Terminus), Jest + supertest e2e sobre `createTestApp()` con PostgreSQL efímero de Testcontainers; test de arquitectura tsarch existente

**Target Platform**: Servicio HTTP Linux/Docker, consultado por monitoreo y orquestador

**Project Type**: web-service (monorepo `backend/` + `frontend/`; esta feature sólo toca `backend/`)

**Performance Goals**: respuesta < 1 s con la base sana; < 5 s con la base colgada (SC-004)

**Constraints**: sin variables de entorno nuevas; sin autenticación; sin datos sensibles en el cuerpo (FR-008); sin caché (FR-010); timeout explícito del ping de 3000 ms (FR-009)

**Scale/Scope**: 1 endpoint, 1 indicador, ~4 archivos de producción nuevos + 2 editados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Capas | ✅ con una desviación justificada | Controller → Service; sin acceso directo desde el controller a nada de infraestructura. Desviación: ver Complexity Tracking |
| II. Dominio rico | ✅ N/A | No hay lógica de negocio |
| III. Validación / exception filter | ✅ | El filtro global no se modifica; la respuesta de salud no pasa por él (no es un error de negocio). No hay input que validar |
| IV. Autenticación | ✅ | `@Public()` existente; el resto de endpoints sigue protegido. No se loguea nada sensible |
| V. Auditoría / VI. Transacciones | ✅ N/A | Sólo lectura |
| VII. Observabilidad | ✅ | Cumple la parte "MUST exponer un endpoint de health check". Logs/métricas/Correlation ID quedan fuera (otras features) |
| VIII. Swagger | ✅ | Decoradores `@nestjs/swagger` en controller + DTO; la spec OpenAPI no se edita a mano |
| IX. Testing | ✅ (con aprobación pendiente) | Unit + e2e con casos felices y borde; tsarch cubre las capas. **Borrar tests viejos de `getHealth` requiere "sí" explícito** — ver abajo |
| X. Definición de terminado | ✅ planificado | Tests verdes, `nest build`, Swagger y colección Postman actualizados |
| XI. Idioma | ✅ | Identificadores en inglés; mensajes/docs en español |
| XII. Spec-first | ✅ | `spec.md` previo; la decisión "sólo base de datos" está en la spec |

**Post-design (re-evaluado tras Fase 1)**: sin cambios; la única desviación (Principio I) queda justificada abajo.

## Project Structure

### Documentation (this feature)

```text
specs/027-health-check/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── health-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── package.json                                  # + @nestjs/terminus@^11.1.1
├── src/
│   ├── app.module.ts                             # + HealthModule en imports
│   ├── app.controller.ts                         # - getHealth()
│   ├── app.service.ts                            # - getHealth()
│   ├── controllers/health/
│   │   ├── health.controller.ts                  # GET /health, @Public(), Swagger, fija 200/503
│   │   ├── health.controller.spec.ts
│   │   └── dto/health-response.dto.ts            # forma documentada en Swagger
│   ├── services/health/
│   │   ├── health.service.ts                     # envuelve HealthCheckService + TypeOrmHealthIndicator
│   │   └── health.service.spec.ts
│   └── modules/health/health.module.ts           # TerminusModule + controller + service
└── test/
    └── health.e2e-spec.ts                        # 200, 503 (query rechazada y colgada), sin token, sin fuga
docs/postman/desapp.postman_collection.json       # request /health: aserciones de cuerpo y descripción
```

**Structure Decision**: se respeta la organización por capa del backend (`controllers/`, `services/`, `modules/`
con subcarpeta por feature), igual que `simulation`, `alerts`, etc. No hay `domain/` ni `repositories/` porque no hay
lógica ni datos de negocio.

### Tests existentes afectados (Principio IX — requiere aprobación explícita)

El comportamiento viejo ("siempre ok, con `service` y `timestamp`") es el que esta feature reemplaza, y no puede
coexistir: dos handlers `GET /health` en `AppController` y `HealthController` rompen el ruteo.

| Test | Qué pasa | Motivo |
|------|----------|--------|
| `src/app.controller.spec.ts` → `describe('getHealth')` | se elimina el bloque | testea un método que deja de existir |
| `src/app.service.spec.ts` → `describe('getHealth')` | se elimina el bloque | ídem |
| `test/protected.e2e-spec.ts` → "GET / y GET /health siguen respondiendo sin token" | **sin cambios** | sigue pasando (200 sin token con la base sana) |

Los otros tests de esos archivos (`getRoot`) no se tocan. Estos borrados **no se ejecutan sin un "sí" explícito** a la
hora de implementar; se reportarán uno por uno.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principio I: el `HealthService` usa `TypeOrmHealthIndicator` (que consulta la `DataSource`) sin pasar por un Repository | El ping `SELECT 1` no maneja entidades ni objetos de dominio, y el indicador de Terminus es justamente la pieza estándar que el equipo decidió usar; es una sonda de infraestructura, no acceso a datos de negocio | Crear un `HealthRepository.ping()` y un indicador custom: más código propio que mantener y testear para obtener lo mismo; el test tsarch igualmente pasa porque no se toca ningún repository/entidad |
