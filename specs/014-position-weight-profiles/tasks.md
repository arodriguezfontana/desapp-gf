# Tasks: Perfiles de Pesos por Posición

**Input**: Design documents from `specs/014-position-weight-profiles/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/quote-response-delta.md ✅ · quickstart.md ✅

**Tests**: Incluidos — requeridos por Principio IX de la constitución y por SC-001/SC-002 del spec (verificables sin base de datos para el dominio puro).

**Organization**: Tareas agrupadas por user story para implementación y validación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: A qué user story pertenece la tarea (US1–US4, spec.md)
- Rutas basadas en la estructura definida en `plan.md`

---

## Phase 1: Setup

**Purpose**: Inicialización de proyecto.

Sin tareas: esta feature reutiliza íntegramente la estructura de módulos ya creada por 012-valuation-strategies (`backend/src/{domain,repositories,services,controllers}/quotation`, `frontend/src/{types,pages}`). No se crean directorios ni dependencias nuevas.

---

## Phase 2: Foundational (Prerequisitos bloqueantes)

**Purpose**: Extender dominio, entidades TypeORM y schema para que ambas ramas (perfil de posición / pesos generales) existan antes de implementar cualquier user story.

**⚠️ CRÍTICO**: Ninguna user story puede comenzar hasta que esta fase esté completa.

- [X] T001 [P] Agregar campo `positionWeights: Partial<Record<Position, Record<string, number>>>` a `ValuationStrategy` en `backend/src/domain/quotation/valuation-strategy.ts`: extender `create()`/`restore()` y agregar getter `positionWeights` (copia defensiva). Extraer un helper privado `validateWeightsSum(weights: Record<string, number>, label: string)` reutilizado por `weights` y por cada entrada de `positionWeights` (tolerancia ±0.001) y reutilizar el chequeo de claves válidas contra `NORMALIZATION_BOUNDS` para cada perfil. Importar `Position` desde `../player/enums/position`.
- [X] T002 [P] Agregar campo `appliedPosition: Position | null` a `PlayerQuote` en `backend/src/domain/quotation/player-quote.ts`: extender `create()`/`restore()` y getter.
- [X] T003 [US1][US2] (depende de T001) Modificar `calculatePlayerValue(player, strategy)` en `backend/src/domain/quotation/calculate-player-value.ts`: resolver `const profile = strategy.positionWeights[player.position]`; `weightsUsed = profile ?? strategy.weights`; `appliedPosition = profile ? player.position : null`; iterar sobre `weightsUsed` (no `strategy.weights`) para el cálculo de score; retornar `{ score, value, appliedPosition, weightsUsed }`.
- [X] T004 [P] Agregar columna `position_weights` (`jsonb`, nullable) a `ValuationStrategyEntity` en `backend/src/repositories/quotation/entities/valuation-strategy.entity.ts`.
- [X] T005 [P] Agregar columna `applied_position` (`varchar(2)`, nullable) a `PlayerQuoteEntity` en `backend/src/repositories/quotation/entities/player-quote.entity.ts`.
- [X] T006 [P] (depende de T001, T004) Actualizar `ValuationStrategyMapper` en `backend/src/repositories/quotation/valuation-strategy.mapper.ts`: `toDomain` mapea `positionWeights: entity.positionWeights ?? {}`; `toPersistence` mapea `positionWeights: Object.keys(domain.positionWeights).length > 0 ? domain.positionWeights : null`.
- [X] T007 [P] (depende de T002, T005) Actualizar `PlayerQuoteMapper` en `backend/src/repositories/quotation/player-quote.mapper.ts`: `toDomain`/`toPersistence` mapean `appliedPosition` (cast a `Position | null`).
- [X] T008 (depende de T004, T005) Crear migration de schema `backend/src/database/migrations/<timestamp>-AddPositionWeightsColumns.ts`: `ALTER TABLE "valuation_strategies" ADD COLUMN "position_weights" jsonb NULL;` y `ALTER TABLE "player_quotes" ADD COLUMN "applied_position" varchar(2) NULL;`. `down()` hace `DROP COLUMN` de ambas en orden inverso. Usar un timestamp posterior a `1791590400000` (ver migrations existentes en el mismo directorio).

**Checkpoint**: Dominio y persistencia compilan con los campos nuevos; migration de schema lista para aplicarse. Listo para user stories.

---

## Phase 3: User Story 1 — Cotizar un jugador con el perfil de su posición (Priority: P1) 🎯 MVP

**Goal**: Al calcular la cotización de un jugador cuya posición tiene perfil definido en la estrategia activa, el sistema usa automáticamente ese perfil (no los pesos generales) y lo registra en el snapshot.

**Independent Test**: `pnpm -C backend test:unit --testPathPattern=calculate-player-value` con un caso de perfil FW definido — el score usa solo las métricas del perfil y `appliedPosition` es `'FW'`.

### Tests para User Story 1

- [X] T009 [P] [US1] Extender `backend/src/domain/quotation/__tests__/calculate-player-value.spec.ts`: caso con `positionWeights` definido para la posición del jugador (p. ej. FW con `goals=0.45, shots=0.25, assists=0.15, rating=0.15`) → el score se calcula únicamente con esas métricas (una métrica fuera del perfil pero presente en `strategy.weights` no debe aportar); `appliedPosition === 'FW'`; `weightsUsed` igual al perfil, no a `strategy.weights`.
- [X] T010 [P] [US1] Extender `backend/src/domain/quotation/__tests__/valuation-strategy.spec.ts`: `create()` acepta `positionWeights` con un perfil que suma 1.0 ±0.001 sobre un subconjunto de métricas; `create()` lanza `InvalidStrategyWeightsError` si algún perfil no suma 1.0 (±0.001) o referencia una métrica fuera de `NORMALIZATION_BOUNDS`; `positionWeights` admite pesos negativos en un perfil (mismo criterio que `weights`).

### Implementación para User Story 1

- [X] T011 [US1] (depende de T003) Actualizar `QuotationService.recalculateAll()` en `backend/src/services/quotation/quotation.service.ts`: usar el `weightsUsed`/`appliedPosition` devuelto por `calculatePlayerValue` al construir cada `PlayerQuote.create({ ..., weightSnapshot: weightsUsed, appliedPosition })` (reemplaza el `weightSnapshot: strategy.weights` actual).
- [X] T012 [P] [US1] (depende de T011) Extender `backend/src/services/quotation/__tests__/quotation.service.spec.ts` (caso "procesa jugadores y devuelve resumen...", ~línea 121): con una estrategia mockeada que define perfil para la posición del jugador de prueba, verificar que `PlayerQuote.create`/`saveMany` recibe `weightSnapshot` igual al perfil y `appliedPosition` igual a esa posición.
- [X] T013 [P] [US1] Agregar campo `appliedPosition: Position | null` a `PlayerQuoteResponseDto` en `backend/src/controllers/quotation/dto/player-quote-response.dto.ts` (constructor, `@ApiProperty` y `fromDomain`).
- [X] T014 [P] [US1] Agregar campo `appliedPosition: Position | null` a `PlayerQuoteDetailResponseDto` en `backend/src/controllers/player/dto/player-quote-detail-response.dto.ts` (constructor, `@ApiProperty` y `fromDomain`).
- [X] T015 [US1] (depende de T011) Extender `backend/src/services/quotation/__tests__/quotation.service.integration.spec.ts` (Testcontainers): con una estrategia de prueba que define perfil para la posición de un jugador de prueba, tras `recalculateAll()` la `PlayerQuote` persistida tiene `appliedPosition` igual a esa posición y `weightSnapshot` igual al perfil (no a los pesos generales de la estrategia).

**Checkpoint**: la ruta "con perfil de posición" funciona end-to-end (dominio → service → persistencia → DTOs) y es la única story necesaria para demostrar el comportamiento central de la feature.

---

## Phase 4: User Story 2 — Cotizar un jugador sin perfil aplicable usando los pesos generales (Priority: P1)

**Goal**: Cuando no hay perfil aplicable para la posición del jugador (o la estrategia no define ninguno), el sistema sigue usando los pesos generales exactamente como antes de esta feature.

**Independent Test**: `pnpm -C backend test:unit --testPathPattern=calculate-player-value` con una estrategia que solo define perfil para FW y un jugador DF — el score coincide con el que resulta de `strategy.weights` y `appliedPosition` es `null`.

### Tests para User Story 2

- [X] T016 [P] [US2] Extender `backend/src/domain/quotation/__tests__/calculate-player-value.spec.ts`: caso estrategia con perfil solo para otra posición (p. ej. solo FW) y jugador DF → usa `strategy.weights`, `appliedPosition: null`, `weightsUsed === strategy.weights`; caso estrategia sin ningún `positionWeights` definido (`{}`) → mismo resultado que el comportamiento preexistente (pre-feature) para cualquier posición, con `appliedPosition: null`.
- [X] T017 [P] [US2] Extender `backend/src/services/quotation/__tests__/quotation.service.integration.spec.ts`: estrategia de prueba con perfil solo para FW, jugador de prueba con posición DF → tras `recalculateAll()`, la `PlayerQuote` persistida tiene `appliedPosition: null` y `weightSnapshot` igual a `strategy.weights`.

### Implementación para User Story 2

- [X] T018 [US2] (depende de T003, T011) Ejecutar los tests T016/T017 y confirmar que el camino de fallback ya queda cubierto por la implementación de T003/T011 sin código adicional (misma función `calculatePlayerValue`, misma llamada en `QuotationService`); si algún caso falla, corregir `calculate-player-value.ts`.

**Checkpoint**: ambas ramas P1 (US1 y US2) verificadas de forma independiente — seguro de desplegar sin romper el comportamiento preexistente para jugadores sin perfil aplicable.

---

## Phase 5: User Story 3 — Seedear los perfiles de posición de las estrategias existentes (Priority: P2)

**Goal**: "Performance general" e "Impacto táctico" tienen, en un entorno limpio, los 8 perfiles de posición especificados (4 por estrategia), cada uno sumando 1.0 ±0.001.

**Independent Test**: Tras aplicar migrations en un entorno limpio, consultar ambas estrategias y verificar los 4 perfiles por estrategia con los pesos exactos de `data-model.md`.

### Tests para User Story 3

- [X] T019 [P] [US3] Crear test de integración (Testcontainers) en `backend/src/repositories/quotation/__tests__/typeorm-valuation-strategy.repository.integration.spec.ts` (extender el archivo existente): tras aplicar todas las migrations, `findById('a1b2c3d4-e5f6-7890-abcd-ef1234567890')` ("Performance general") y `findById('b2c3d4e5-f6a7-8901-bcde-f12345678901')` ("Impacto táctico") retornan `positionWeights` con las 4 posiciones (`FW`, `MF`, `DF`, `GK`) y cada perfil suma 1.0 ±0.001 (ver tabla de verificación en `data-model.md`). **Nota de implementación**: el entorno de test usa `DatabaseModule` con `synchronize: true` (no corre migrations de archivo), así que el test inserta las dos filas con los ids reales de seed y ejercita `SeedPositionWeightProfiles.up()` directamente sobre un `QueryRunner` de la conexión de test, en vez de asumir que la migration ya corrió — ver Notes.

### Implementación para User Story 3

- [X] T020 [US3] (depende de T008) Crear migration de datos `backend/src/database/migrations/<timestamp+1d>-SeedPositionWeightProfiles.ts`: dos `UPDATE "valuation_strategies" SET "position_weights" = '{...}' WHERE "id" = '...'` (uno por estrategia) con los 8 perfiles exactos de `data-model.md` (usando los nombres de campo del dominio `shots`/`passesCompleted`, no `totalShots`/`accuratePasses` — ver research.md Decisión 1). `down()` revierte ambas a `position_weights = NULL`.

**Checkpoint**: entorno limpio seedeado con los 8 perfiles; US1/US2 tienen datos reales de seed para ejercitarse end-to-end además de los fixtures de test.

---

## Phase 6: User Story 4 — Ver en el detalle del jugador si se usó perfil o pesos generales (Priority: P3)

**Goal**: La ficha de un jugador indica si su cotización vigente se calculó con el perfil de su posición o con los pesos generales de la estrategia.

**Independent Test**: Abrir `/players/:id` para un jugador cuya cotización vigente tiene `appliedPosition` no nulo → se muestra el indicador de perfil; para uno con `appliedPosition: null` → se muestra el indicador de pesos generales.

### Implementación para User Story 4

- [X] T021 [P] [US4] Agregar campo `appliedPosition: Position | null` a la interfaz `PlayerQuote` en `frontend/src/types/catalog.types.ts`.
- [X] T022 [US4] (depende de T021) En `frontend/src/pages/PlayerDetailPage.tsx`, agregar un indicador junto al bloque "Valor token" (~línea 174-181): si `quote != null`, mostrar "Perfil de posición ({getPositionLabel(quote.appliedPosition)})" cuando `quote.appliedPosition` no es `null`, o "Pesos generales de la estrategia" cuando es `null`; no mostrar nada si `quote` es `null`.
- [X] T023 [US4] (depende de T022) Extender `frontend/src/pages/PlayerDetailPage.spec.tsx`: caso cotización con `appliedPosition` no nulo → se renderiza el indicador de perfil con la posición correspondiente; caso cotización con `appliedPosition: null` → se renderiza el indicador de pesos generales; caso sin cotización (`quote: null`) → no se renderiza ningún indicador (comportamiento preexistente para el valor del token).

**Checkpoint**: la ficha del jugador comunica el origen de su cotización vigente — todas las user stories del spec quedan cubiertas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Entregables finales requeridos por Principio X (Definición de terminado).

- [X] T024 [P] Verificar que Swagger refleja el campo `appliedPosition` en `PlayerQuoteResponseDto` y `PlayerQuoteDetailResponseDto`: confirmado contra `http://localhost:3000/docs-json` (servidor de desarrollo ya corriendo) — ambos DTOs listan `appliedPosition` en sus `properties`.
- [X] T025 [P] Actualizar la colección Postman del proyecto (`docs/postman/desapp.postman_collection.json`): se agregó `pm.expect(body).to.have.property('appliedPosition')` a los 4 tests de 200 OK de `GET /players/:id/quote` (Feature 3 y Feature 13). `GET /quotes/player/:playerId` no tiene requests propios en la colección (gap preexistente, fuera de alcance).
- [X] T026 Escenarios de `quickstart.md` verificados por equivalencia con la suite automatizada en lugar de curl manual contra la base real de desarrollo (ver Notes): Escenarios 1-4 (perfil aplicado, fallback, cambio de estrategia, reproducibilidad histórica) ⇔ T009/T010/T015-T017/T019; Escenario 5 (indicador en frontend) ⇔ T023; Escenario 6 (tests de dominio puro) ejecutado directamente y en verde.
- [X] T027 [P] Verificar que `pnpm -C backend build` (nest build) pasa sin errores.
- [X] T028 [P] Ejecutar `pnpm -C backend test:arch` (tsarch) y confirmar que no se violan las reglas de capas del Principio I: `domain/quotation/` sigue sin imports de TypeORM/NestJS; `QuotationService` sigue sin ver `ValuationStrategyEntity`/`PlayerQuoteEntity` ni los mappers.
- [X] T029 [P] Verificar que `pnpm -C frontend build` (vite build) pasa sin errores.

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin tareas.
- **Phase 2 (Foundational)**: Bloquea todas las user stories.
- **Phase 3 (US1)**: Depende de Phase 2. No depende de otras user stories.
- **Phase 4 (US2)**: Depende de Phase 2 y de T003/T011 (comparte la misma implementación que US1; sus tests son independientes).
- **Phase 5 (US3)**: Depende de Phase 2 (T008, la migration de schema). Puede hacerse en paralelo con Phase 3/4.
- **Phase 6 (US4)**: Depende de Phase 3 (T013, el DTO `appliedPosition` que consume el frontend vía `GET /quotes/player/:playerId`).
- **Phase 7 (Polish)**: Depende de todas las fases anteriores.

### Dependencias entre user stories

- **US1 (P1)**: Depende de Foundational. Es la primera en implementarse (MVP).
- **US2 (P1)**: Depende de Foundational y de la implementación de US1 (T003/T011 son compartidos; no hay código nuevo propio de US2 más allá de tests — ver T018). Independientemente testeable con sus propios casos.
- **US3 (P2)**: Depende solo de Foundational (T008). Puede hacerse en paralelo con US1/US2.
- **US4 (P3)**: Depende de US1 (T013, campo `appliedPosition` en el DTO que consume el frontend).

### Dentro de cada user story

- Tests antes de implementación (red → green) donde aplica.
- Dominio (T001-T003) antes de persistencia/mappers (T004-T007) antes de migration (T008).
- Service (T011) antes de DTOs (T013/T014) antes de frontend (T021-T023).

### Oportunidades de paralelismo

- T001, T002, T004, T005 (Phase 2) — en paralelo entre sí
- T006, T007 (Phase 2, tras T001/T002/T004/T005) — en paralelo entre sí
- T009, T010 (tests US1) — en paralelo
- T013, T014 (DTOs US1) — en paralelo
- T016, T017 (US2) — en paralelo
- T019 (test US3) puede hacerse en paralelo con Phase 3/4 una vez completado T008
- T024, T025, T027, T028, T029 (Polish) — en paralelo

---

## Parallel Example: Phase 2

```bash
Task: "T001 positionWeights en ValuationStrategy"
Task: "T002 appliedPosition en PlayerQuote"
Task: "T004 columna position_weights en ValuationStrategyEntity"
Task: "T005 columna applied_position en PlayerQuoteEntity"
```

## Parallel Example: User Story 1

```bash
# Tests en paralelo:
Task: "T009 Tests calculate-player-value — perfil aplicado"
Task: "T010 Tests ValuationStrategy — validación de positionWeights"

# DTOs en paralelo (tras T011):
Task: "T013 appliedPosition en PlayerQuoteResponseDto"
Task: "T014 appliedPosition en PlayerQuoteDetailResponseDto"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Phase 2: Foundational — **CRÍTICO**, bloquea todo.
2. Completar Phase 3: US1 — perfil de posición aplicado end-to-end.
3. Completar Phase 4: US2 — fallback a pesos generales verificado.
4. **STOP y VALIDAR**: `pnpm -C backend test:unit --testPathPattern=calculate-player-value` y `quotation.service` en verde.
5. Esto es el MVP: ambas ramas P1 del spec funcionan de forma segura.

### Incremental Delivery

1. Foundational → base lista (dominio + persistencia + migration de schema).
2. US1 → perfil de posición aplicado, DTOs extendidos → demostrable vía `GET /quotes/player/:playerId`.
3. US2 → fallback verificado → **MVP completo** (ambas ramas P1).
4. US3 → seed de los 8 perfiles reales → la feature tiene datos de producción, no solo fixtures de test.
5. US4 → indicador en frontend → feature completa end-to-end incluyendo UI.
6. Polish → Swagger, Postman, build, tsarch.

### Estrategia de equipo (paralelo)

Con múltiples desarrolladores, tras completar Phase 2:
- Dev A: US1 (tests + wiring de `QuotationService` + DTOs)
- Dev B: US3 (migration de seed + test de integración) — solo depende de T008, no de T011
- Dev C espera T013 (DTO de US1): US4 (frontend)

---

## Notes

- [P] = archivos distintos, sin dependencias entre sí en ese momento.
- Cada user story es completable y testeable de forma independiente.
- `appliedPosition: null` significa "pesos generales"; un valor de `Position` significa "perfil de esa posición" — un solo campo nullable, no un booleano + posición separados (research.md Decisión 2).
- Nombres de métricas en los perfiles de seed: `shots` (no `totalShots`), `passesCompleted` (no `accuratePasses`) — mismo criterio que 012-valuation-strategies.
- No se agrega ningún endpoint ni flag para editar `positionWeights` en runtime — exclusivamente seed (spec FR-008).
- `GET /quotes/strategies` (panel admin) no se modifica — `positionWeights` no se expone ahí (research.md Decisión 6).
- Los tests de integración (`*.integration.spec.ts`) corren contra `DatabaseModule` con `synchronize: true` (Testcontainers), no contra migrations de archivo — por eso T019 ejercita `SeedPositionWeightProfiles.up()` directamente en vez de depender de que la migration ya haya corrido. En un entorno real (dev/CI con `migration:run`), la migration sí aplica automáticamente.
- T026 no se validó con curl manual contra la base de desarrollo real (evitar generar usuarios/API keys nuevos ahí sin pedir permiso); se validó por equivalencia con los tests automatizados que ejercitan exactamente los mismos escenarios. Si se quiere la validación manual real, generar una ApiKey de admin (feature 008) y seguir `quickstart.md` directamente.
