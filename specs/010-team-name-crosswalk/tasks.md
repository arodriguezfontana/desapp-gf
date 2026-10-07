# Tasks: Team Name Crosswalk (WhoScored ↔ Football-Data)

**Input**: Design documents from `specs/010-team-name-crosswalk/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [data-model.md](data-model.md) · [contracts/resolve-team.md](contracts/resolve-team.md) · [research.md](research.md)

**Tests**: Incluidos — requeridos por Constitución Principio IX (tests unitarios de dominio sin NestJS/DB; test de integración con Testcontainers para el repositorio).

**Organización**: Agrupadas por User Story para permitir implementación y validación independiente.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: User Story a la que pertenece la tarea (US1, US2)
- Rutas relativas a `backend/`

---

## Phase 1: Setup

**Propósito**: Única modificación de configuración que habilita el script standalone.

- [x] T001 Agregar script `"seed:crosswalk": "ts-node scripts/seed-crosswalk.ts"` en `package.json` (sección `scripts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Propósito**: Bloques de dominio puro que US1 y US2 necesitan antes de empezar. Sin NestJS ni TypeORM.

**⚠️ CRÍTICO**: No puede empezar ninguna User Story hasta completar esta fase.

- [x] T002 [P] Implementar `normalizeTeamName(name: string): string` en `src/domain/competition/normalize-team-name.ts` — minúsculas, NFD/acentos, prefijos FC/AFC/CF/SC/SL/AS/SS/FK, colapsar espacios
- [x] T003 [P] Escribir unit tests de `normalizeTeamName` en `src/domain/competition/normalize-team-name.spec.ts` — casos: prefijo FC, sufijo FC, diéresis, acento, prefijo AFC, SS, string vacío
- [x] T004 [P] Implementar clase de dominio `TeamNameException` en `src/domain/competition/team-name-exception.ts` — constructor privado, `create()`, `restore()`, getters para `whoScoredRawName`, `footballDataTeamId`, `footballDataTeamName`, `leagueCode`

**Checkpoint**: Los tres archivos sin imports de NestJS ni TypeORM — verificable con `grep -r "@nestjs\|typeorm" src/domain/competition/normalize-team-name.ts src/domain/competition/team-name-exception.ts`.

---

## Phase 3: User Story 1 — `resolveTeam` funciona de extremo a extremo (Priority: P1) 🎯 MVP

**Goal**: Dado un nombre de equipo de WhoScored y una lista de `Standing[]`, la función `resolveTeam` devuelve el `Standing` correcto o `null`. La tabla `team_name_exception` existe en DB, el repositorio la lee, y el módulo está cableado en la app.

**Independent Test**: `npm run test:unit -- --testPathPattern="resolve-team"` + `npm run test:integration -- --testPathPattern="typeorm-team-name-exception"` — sin levantar la app.

### Persistencia y módulo

- [x] T005 [P] [US1] Crear `TeamNameExceptionEntity` en `src/repositories/competition/entities/team-name-exception.entity.ts` — `@Entity('team_name_exception')`, columnas: `id` (uuid PK), `whoScoredRawName` (varchar 200, unique), `footballDataTeamId` (integer), `footballDataTeamName` (varchar 100), `leagueCode` (varchar 10), `createdAt`
- [x] T006 [P] [US1] Definir interfaz `TeamNameExceptionRepository` en `src/repositories/competition/team-name-exception.repository.ts` — único método: `findAll(): Promise<TeamNameException[]>`
- [x] T007 [P] [US1] Crear migration `src/database/migrations/1791158400000-CreateTeamNameExceptionTable.ts` — `CREATE TABLE IF NOT EXISTS team_name_exception` con columnas del data-model, `UNIQUE` en `whoscored_raw_name`; `down()` hace `DROP TABLE IF EXISTS`
- [x] T008 [US1] Crear `TeamNameExceptionMapper` en `src/repositories/competition/mappers/team-name-exception.mapper.ts` — `toDomain(entity)` y `toEntity(domain)` (depende de T005)
- [x] T009 [US1] Implementar `TypeOrmTeamNameExceptionRepository` en `src/repositories/competition/typeorm-team-name-exception.repository.ts` — inyecta `DataSource`, implementa `findAll()` usando `TeamNameExceptionMapper` (depende de T005, T006, T008)
- [x] T010 [US1] Crear `src/modules/competition/team-crosswalk.constants.ts` con token `TEAM_NAME_EXCEPTION_REPOSITORY` y `src/modules/competition/team-crosswalk.module.ts` — `TypeOrmModule.forFeature([TeamNameExceptionEntity])`, provee `TypeOrmTeamNameExceptionRepository` bajo el token, exporta el token (depende de T009)
- [x] T011 [US1] Registrar `TeamCrosswalkModule` en `src/app.module.ts` en el array de `imports` (depende de T010)

### Función de dominio

- [x] T012 [P] [US1] Implementar `resolveTeam(whoScoredTeamName, standings, exceptions): Standing | null` en `src/domain/competition/resolve-team.ts` — paso 1: normalización contra `standing.teamName`; paso 2: lookup por `whoScoredRawName` exacto en exceptions, devuelve el standing cuyo `externalTeamId === exception.footballDataTeamId`; `null` si ninguno resuelve (depende de T002, T004)

### Tests

- [x] T013 [US1] Escribir unit tests de `resolveTeam` en `src/domain/competition/resolve-team.spec.ts` — casos: match por normalización, match por excepción manual, `null` cuando no hay match, `null` con standings vacío, `null` con nombre vacío, prioridad de normalización sobre excepción (depende de T012)
- [x] T014 [US1] Escribir integration test de `TypeOrmTeamNameExceptionRepository` en `src/repositories/competition/typeorm-team-name-exception.repository.integration.spec.ts` — Testcontainers + PostgreSQL efímero: tabla vacía devuelve `[]`, tabla con filas devuelve `TeamNameException[]` correctamente mapeados (depende de T009)

**Checkpoint**: `npm run test:unit -- --testPathPattern="normalize-team-name|resolve-team"` y `npm run test:integration -- --testPathPattern="typeorm-team-name-exception"` en verde. User Story 1 completa.

---

## Phase 4: User Story 2 — Script de verificación de cobertura (Priority: P2)

**Goal**: `npm run seed:crosswalk` imprime cuántos equipos de `Player.team` resuelven contra los standings de Football-Data, y escribe los sin resolver en `team_crosswalk_unresolved.txt`.

**Independent Test**: Ejecutar `npm run seed:crosswalk` con DB local y `FOOTBALL_DATA_API_TOKEN` configurados — ver resumen en consola y (si hay sin resolver) `team_crosswalk_unresolved.txt` en `backend/`.

### Implementación

- [x] T015 [US2] Implementar `scripts/seed-crosswalk.ts` — crea `DataSource` standalone con `DATABASE_URL`, llama `GET /competitions/{code}/standings` con `axios` para las 5 ligas (`PL`, `BL1`, `PD`, `SA`, `FL1`), lee `SELECT DISTINCT team FROM players WHERE removed_at IS NULL`, carga `team_name_exception` vía TypeORM, corre `resolveTeam` por cada equipo distinto, imprime resumen (total / por normalización / por excepción / sin resolver), escribe `team_crosswalk_unresolved.txt` si hay sin resolver, sale con `process.exit(0)`/`process.exit(1)` según resultado (depende de T001, T012, T009)

**Checkpoint**: `npm run seed:crosswalk` corre sin error de compilación ni de conexión. User Story 2 completa.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T016 [P] Verificar que el test de arquitectura sigue en verde: `npm run test -- --testPathPattern="architecture"` — confirmar que `normalize-team-name.ts`, `resolve-team.ts` y `team-name-exception.ts` no importan NestJS ni TypeORM
- [x] T017 Verificar build completo: `npm run build` desde `backend/` sin errores de TypeScript

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empieza inmediatamente
- **Foundational (Phase 2)**: Sin dependencias — puede correr en paralelo con Phase 1
- **US1 (Phase 3)**: Requiere Phase 2 completa
- **US2 (Phase 4)**: Requiere T001 (Phase 1) y T012 (Phase 3)
- **Polish (Phase 5)**: Requiere US1 y US2 completas

### User Story Dependencies

- **US1 (P1)**: Depende de Phase 2 (T002, T004). Independiente de US2.
- **US2 (P2)**: Depende de T001 (setup del script en package.json) y T012 (`resolveTeam`).

### Within User Story 1

```
T005, T006, T007, T012  →  pueden empezar en paralelo al completar Phase 2
T008                    →  depende de T005
T009                    →  depende de T005, T006, T008
T010                    →  depende de T009
T011                    →  depende de T010
T013                    →  depende de T012
T014                    →  depende de T009
```

### Parallel Opportunities

```bash
# Phase 2 — los 3 en paralelo:
T002  normalize-team-name.ts
T003  normalize-team-name.spec.ts
T004  team-name-exception.ts

# Phase 3 — bloque inicial en paralelo (tras Phase 2):
T005  team-name-exception.entity.ts
T006  team-name-exception.repository.ts
T007  migration 1791158400000-...
T012  resolve-team.ts
```

---

## Implementation Strategy

### MVP (User Story 1 únicamente)

1. Phase 1: T001
2. Phase 2: T002, T003, T004 (en paralelo)
3. Phase 3: T005–T014
4. **Validar**: `npm run test:unit` + `npm run test:integration` en verde
5. `npm run build` sin errores

### Entrega incremental

1. MVP (pasos anteriores) → US1 lista y testeable
2. Phase 4: T015 → US2 lista
3. Phase 5: T016, T017 → polish

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes entre sí
- `[US1]` / `[US2]` = trazabilidad con las user stories del spec
- T003 puede escribirse antes de T002 (TDD) o después — ambos son archivos distintos
- T007 (migration) es independiente del resto de la persistencia — puede hacerse en cualquier orden dentro de Phase 3
- El test de arquitectura (T016) es el guardián automático de Principio I — si falla, revisar imports en los archivos de dominio nuevos
