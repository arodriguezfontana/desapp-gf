# Tasks: Historial de Cotizaciones del Jugador

**Input**: Design documents from `specs/015-player-quote-history/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/player-quotes-history-api.md ✅ · quickstart.md ✅

**Tests**: Incluidos — requeridos por Principio IX de la constitución y por SC-001/SC-002/SC-003 del spec.

**Organization**: Tareas agrupadas por user story para implementación y validación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: A qué user story pertenece la tarea (US1–US2, spec.md)
- Rutas basadas en la estructura definida en `plan.md`

---

## Phase 1: Setup

Sin tareas: esta feature reutiliza íntegramente los módulos ya existentes (`quotation`, `player`) y no agrega dependencias nuevas al frontend (research.md Decisión 3).

## Phase 2: Foundational

Sin tareas: a diferencia de otras features de este proyecto, aquí no hay ningún cambio de dominio/persistencia compartido por ambas user stories. US1 es un cambio vertical autocontenido en backend (repositorio → service → controller); US2 depende de que US1 esté completo (consume el endpoint ya desplegado), no de ninguna pieza foundational separada. Ver "User Story Dependencies" más abajo.

---

## Phase 3: User Story 1 — Consultar el historial completo de cotizaciones de un jugador (Priority: P1) 🎯 MVP

**Goal**: `GET /players/:id/quotes` devuelve todas las `PlayerQuote` de un jugador, ordenadas ascendente por `calculatedAt`; 404 si el jugador no existe; 200 con `[]` si existe sin cotizaciones.

**Independent Test**: `cd backend && npx jest player-quote-history quotation.service typeorm-player-quote.repository.integration` — todos los casos en verde, sin depender de ninguna pieza de frontend.

### Tests para User Story 1

- [X] T001 [P] [US1] Extender `backend/src/repositories/quotation/__tests__/typeorm-player-quote.repository.integration.spec.ts` con un nuevo `describe('findAllByPlayerId')`: retorna `[]` si el jugador no tiene cotizaciones; retorna todas las cotizaciones de `PLAYER_ID` ordenadas ascendente por `calculatedAt` (insertar 3 con fechas distintas fuera de orden y verificar el orden de salida); no incluye cotizaciones de otro `playerId`.
- [X] T002 [P] [US1] Extender `backend/src/services/quotation/__tests__/quotation.service.spec.ts` con un nuevo `describe('getQuoteHistory()')`: lanza `PlayerNotFoundError` si `playerRepository.findById` resuelve `null`; retorna `[]` si el jugador existe y el repositorio de cotizaciones resuelve `[]`; retorna exactamente lo que resuelve `quoteRepository.findAllByPlayerId` (sin reordenar ni transformar en el Service).
- [X] T003 [US1] (depende de T004-T007) Crear `backend/test/quotation/player-quote-history.e2e-spec.ts` (Testcontainers + supertest, no confundir con `player-quote-historical.e2e-spec.ts` de 013 — research.md Decisión 4): `GET /players/:id/quotes` → 200 con array ordenado ascendente tras varios recálculos; 200 `[]` para un jugador recién creado sin recalcular; 404 para un id inexistente; 401 sin `x-api-key`.

### Implementación para User Story 1

- [X] T004 [US1] Agregar `findAllByPlayerId(playerId: string): Promise<PlayerQuote[]>` a la interfaz `PlayerQuoteRepository` en `backend/src/repositories/quotation/player-quote.repository.ts`.
- [X] T005 [US1] (depende de T004) Implementar `findAllByPlayerId` en `TypeOrmPlayerQuoteRepository` (`backend/src/repositories/quotation/typeorm-player-quote.repository.ts`): `this.repo.find({ where: { playerId }, order: { calculatedAt: 'ASC' } })`, mapeado con `PlayerQuoteMapper.toDomain`.
- [X] T006 [US1] (depende de T005) Agregar `getQuoteHistory(playerId: string): Promise<PlayerQuote[]>` a `QuotationService` (`backend/src/services/quotation/quotation.service.ts`): valida `await this.playerRepository.findById(playerId)`, lanza `PlayerNotFoundError` si es `null` (mismo patrón que `getQuoteAtDate`), y si no delega en `this.quoteRepository.findAllByPlayerId(playerId)`.
- [X] T007 [US1] (depende de T006) Agregar el endpoint `GET ':id/quotes'` a `PlayerController` (`backend/src/controllers/player/player.controller.ts`): llama a `quotationService.getQuoteHistory(id)` y mapea cada elemento con `PlayerQuoteResponseDto.fromDomain` (reutilizado, research.md Decisión 2); decoradores `@ApiOperation`, `@ApiResponse({ status: 200, type: [PlayerQuoteResponseDto] })`, `@ApiResponse({ status: 401 })`, `@ApiResponse({ status: 404 })`.

**Checkpoint**: el historial completo es consultable end-to-end vía API, con los tres códigos de respuesta (200 con datos, 200 vacío, 404) verificados.

---

## Phase 4: User Story 2 — Visualizar la evolución del valor de un jugador en un gráfico (Priority: P2)

**Goal**: La ficha de detalle del jugador muestra un gráfico de líneas (eje X = `calculatedAt`, eje Y = `value`) alimentado por el historial de US1; si no hay historial, muestra un estado vacío en vez de un gráfico roto.

**Independent Test**: `cd frontend && npx vitest run QuoteHistoryChart PlayerDetailPage` — casos de gráfico con datos, gráfico con un solo punto y estado vacío, todos mockeando la respuesta del servicio (sin depender de que el backend esté corriendo).

### Implementación para User Story 2

- [X] T008 [P] [US2] Agregar `getQuoteHistoryByPlayerId(playerId: string): Promise<PlayerQuote[]>` a `frontend/src/service/catalogService.ts`: `httpClient.get<PlayerQuote[]>(\`/players/${playerId}/quotes\`, { useApiKey: true })`.
- [X] T009 [US2] (depende de T008) Agregar `getQuoteHistoryByPlayerId` a `frontend/src/hooks/useCatalog.ts`, siguiendo el mismo patrón `useCallback` que `getLatestQuoteByPlayerId`.
- [X] T010 [P] [US2] Crear `frontend/src/components/QuoteHistoryChart.tsx`: props `{ quotes: PlayerQuote[] }`; si `quotes.length === 0` renderiza un estado vacío explícito (texto, sin `<svg>`); si no, renderiza un `<svg>` con un `<polyline>` cuyos puntos normalizan `calculatedAt` (eje X) y `value` (eje Y) al `viewBox` (sin librería de charting — research.md Decisión 3). Un solo punto (`quotes.length === 1`) debe renderizar sin error (sin línea, o un punto único).
- [X] T011 [P] [US2] Crear `frontend/src/components/QuoteHistoryChart.spec.tsx`: con 3+ cotizaciones se renderiza el `<svg>`/`<polyline>`; con `quotes: []` se renderiza el estado vacío (y no el `<svg>`); con una sola cotización no lanza error.
- [X] T012 [US2] (depende de T009, T010) Integrar `<QuoteHistoryChart quotes={...} />` en `frontend/src/pages/PlayerDetailPage.tsx`: agregar `getQuoteHistoryByPlayerId` al `Promise.all` que ya carga `player` y `quote`, guardar en un nuevo estado (`quoteHistory`), renderizar el componente debajo de las secciones existentes.
- [X] T013 [US2] (depende de T012) Extender `frontend/src/pages/PlayerDetailPage.spec.tsx`: caso jugador con historial (mock de `getQuoteHistoryByPlayerId` con varias entradas) → el gráfico se renderiza; caso jugador sin historial (mock resuelve `[]`) → se renderiza el estado vacío del historial, no el gráfico.

**Checkpoint**: la ficha del jugador comunica visualmente la evolución de su valor — ambas user stories del spec quedan cubiertas.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Entregables finales requeridos por Principio X (Definición de terminado).

- [X] T014 [P] Verificar que Swagger documenta `GET /players/:id/quotes` con `PlayerQuoteResponseDto` como array de respuesta 200 (confirmado contra `/docs-json` del servidor de desarrollo ya corriendo).
- [X] T015 [P] Actualizar la colección Postman del proyecto (`docs/postman/desapp.postman_collection.json`) agregando un request para `GET /players/:id/quotes` (200 con datos ordenados, 200 vacío, 404), siguiendo el estilo ya usado para `GET /players/:id/quote` en Feature 3.
- [X] T016 Escenarios de `quickstart.md` verificados por equivalencia con la suite automatizada: Escenarios 1-3 (historial ordenado, vacío, 404) ⇔ `player-quote-history.e2e-spec.ts` (4/4 verde); Escenario 4 (frontend) ⇔ `QuoteHistoryChart.spec.tsx` + `PlayerDetailPage.spec.tsx`; Escenario 5 (dominio/repo) ejecutado directamente y en verde. Suite e2e completa también verificada: 12/12 suites, 107/107 tests.
- [X] T017 [P] Verificar que `pnpm -C backend build` (nest build) pasa sin errores.
- [X] T018 [P] Ejecutar `pnpm -C backend test:arch` (tsarch) y confirmar que no se violan las reglas de capas: `PlayerController` sigue sin importar repositorios directamente; `domain/quotation/` sigue sin imports de TypeORM/NestJS.
- [X] T019 [P] Verificar que `pnpm -C frontend build` (vite build) pasa sin errores.

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)** y **Phase 2 (Foundational)**: sin tareas.
- **Phase 3 (US1)**: sin dependencias de otra user story. Es la primera en implementarse (MVP).
- **Phase 4 (US2)**: depende de que US1 esté completo (T007) — el frontend necesita el endpoint real desplegado para tener algo que consumir, aunque T008/T010/T011 (service, componente y su test con props mockeadas) se pueden escribir en paralelo sin backend corriendo.
- **Phase 5 (Polish)**: depende de Phase 3 y Phase 4.

### Dependencias entre user stories

- **US1 (P1)**: independiente. Entrega valor por sí sola (consumible vía API/Postman aunque no haya UI todavía).
- **US2 (P2)**: depende de US1 (consume su contrato HTTP). Internamente independiente: el componente `QuoteHistoryChart` (T010/T011) se puede desarrollar y testear con props mockeadas sin esperar a que el backend esté desplegado, pero la integración final en `PlayerDetailPage` (T012) sí requiere el endpoint real para probarse end-to-end.

### Dentro de cada user story

- Tests antes de implementación (red → green) donde aplica.
- Repositorio (T004-T005) antes de Service (T006) antes de Controller (T007).
- Service de frontend (T008) antes de hook (T009) antes de integración en página (T012).
- Componente de gráfico (T010) y su test (T011) pueden hacerse en paralelo con el service/hook (T008/T009) — no comparten archivos.

### Oportunidades de paralelismo

- T001, T002 (tests US1) — en paralelo
- T008, T010, T011 (US2: service de frontend y componente de gráfico + su test) — en paralelo entre sí
- T014, T015, T017, T018, T019 (Polish) — en paralelo

---

## Parallel Example: User Story 1

```bash
Task: "T001 Tests de findAllByPlayerId en typeorm-player-quote.repository.integration.spec.ts"
Task: "T002 Tests de getQuoteHistory en quotation.service.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T008 getQuoteHistoryByPlayerId en catalogService.ts"
Task: "T010 Componente QuoteHistoryChart.tsx"
Task: "T011 Test QuoteHistoryChart.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 3: US1 — endpoint funcional, verificable con `curl`/Postman sin ninguna pieza de frontend.
2. **STOP y VALIDAR**: `npx jest player-quote-history quotation.service typeorm-player-quote.repository.integration` en verde; Escenarios 1-3 de `quickstart.md` pasan a mano.
3. Esto ya es un incremento demostrable: el historial existe y es consultable, aunque todavía no se vea en ningún lado.

### Incremental Delivery

1. US1 → endpoint completo y testeado → demostrable vía API/Postman.
2. US2 → gráfico en la ficha del jugador → feature completa end-to-end, incluyendo UI.
3. Polish → Swagger, Postman, build, tsarch.

### Estrategia de equipo (paralelo)

Con dos desarrolladores: Dev A hace US1 completo (T001-T007); Dev B puede adelantar T008/T010/T011 de US2 en paralelo (no dependen de que el backend esté terminado, solo de la forma ya conocida de `PlayerQuote` — ver contracts/), y recién necesita que Dev A termine T007 para integrar T012/T013.

---

## Notes

- [P] = archivos distintos, sin dependencias entre sí en ese momento.
- Esta feature no agrega migraciones ni entidades nuevas — todo el trabajo de US1 es lectura sobre `player_quotes` ya existente.
- No se agrega ninguna librería de charting al frontend (research.md Decisión 3) — `QuoteHistoryChart` es SVG inline propio.
- El archivo e2e nuevo se llama `player-quote-history.e2e-spec.ts` (listado completo), no "historical" (que ya significa "consulta puntual a una fecha", spec 013) — research.md Decisión 4.
