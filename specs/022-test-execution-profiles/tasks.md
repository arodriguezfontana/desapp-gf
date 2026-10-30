# Tasks: Perfiles de ejecución de tests separados por costo

**Input**: Design documents from `specs/022-test-execution-profiles/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Nota**: Esta feature modifica un único archivo de configuración (`.github/workflows/ci.yml`). No hay código de aplicación, entidades de dominio, ni tests nuevos. La organización por fases refleja la secuencia lógica de validación, no la complejidad.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Auditoría del estado actual)

**Purpose**: Confirmar el estado real del repo antes de tocar cualquier cosa.

- [x] T001 Auditar los scripts npm de backend en `backend/package.json` y confirmar que `test:unit`, `test:integration` y `test:e2e` existen y apuntan a los patrones correctos
- [x] T002 [P] Auditar los scripts npm de frontend en `frontend/package.json` y confirmar que `test:unit` y `test:integration` existen
- [x] T003 [P] Auditar `backend/test/jest-e2e.json` y confirmar que `testRegex` apunta a `\.e2e-spec\.ts$`
- [x] T004 Leer `.github/workflows/ci.yml` completo y documentar el estado actual del job `backend` (qué steps corre y en qué eventos)

**Checkpoint**: Confirmado que los scripts ya existen y que `ci.yml` es el único archivo a cambiar.

---

## Phase 2: Foundational (Sin prerequisitos bloqueantes)

Esta feature no tiene prerequisitos bloqueantes. El trabajo comienza directamente en las user stories.

---

## Phase 3: User Story 1 + 2 — Separación de perfiles en CI (Priority: P1) 🎯 MVP

**Goal**: Dividir el job `backend` de `ci.yml` en `backend-unit` (todo push) y `backend-heavy` (PR a main o push a main), agregar la integración del frontend como job pesado (`frontend-heavy`) y condicionar `sonarqube` con la misma regla.

**Independent Test**: Hacer push a una rama feature y verificar que solo corre `backend-unit`; abrir un PR a main y verificar que corren `backend-unit` + `backend-heavy` + frontend integration.

> US1 y US2 se implementan juntas porque viven en el mismo archivo y el cambio es atómico.

### Implementación

- [x] T005 [US1] [US2] En `.github/workflows/ci.yml`: renombrar el job `backend` a `backend-unit` y eliminar los steps `Test (integration)` y `Test (e2e)` de ese job
- [x] T006 [US1] [US2] En `.github/workflows/ci.yml`: agregar el job `backend-heavy` con condición de PR a main (ampliada después a push a main, commit `9ad1990`), incluyendo los steps de checkout, pnpm, node, install, `pnpm test:integration` y `pnpm test:e2e` (working-directory: backend)
- [x] T007 [US2] En `.github/workflows/ci.yml`: agregar `pnpm test:integration` del frontend (working-directory: frontend); quedó finalmente en su propio job `frontend-heavy` (commits `60eeb2c` y `8e8a543`)

**Checkpoint**: `ci.yml` actualizado. US1 y US2 completas — verificar con quickstart.md escenarios 1 y 2.

---

## Phase 4: User Story 3 — Verificación de integridad de tests (Priority: P2)

**Goal**: Confirmar que ningún archivo de test fue modificado como consecuencia del cambio.

**Independent Test**: `git diff HEAD -- '**/*.spec.ts' '**/*.integration.spec.ts' '**/*.e2e-spec.ts'` produce output vacío.

### Implementación

- [x] T008 [US3] Ejecutar `git diff HEAD -- backend/src backend/test frontend/src frontend/test` y confirmar que ningún archivo de test aparece modificado
- [x] T009 [US3] Ejecutar `git diff HEAD -- .github/workflows/ci.yml` y revisar que el diff contiene únicamente los cambios esperados (split de job + nuevo job pesado)

**Checkpoint**: Integridad de tests confirmada. US3 completa.

---

## Phase 5: Polish & Validación end-to-end

- [x] T010 [P] Correr `pnpm test:unit` en `backend/` localmente y confirmar que pasa sin levantar contenedores (quickstart.md escenario local 1)
- [x] T011 [P] Correr `pnpm test:integration` en `backend/` localmente y confirmar que Testcontainers levanta y destruye el Postgres (quickstart.md escenario local 2)
- [x] T012 [P] Correr `pnpm test:e2e` en `backend/` localmente y confirmar que pasa (quickstart.md escenario local 3)
- [x] T013 Actualizar `research.md` si el estado final difiere de lo documentado (no hubo desviaciones — scripts de frontend ya correctos)

---

## Phase 6: Ajustes posteriores a la implementación inicial

- [x] T014 En `.github/workflows/ci.yml`: ampliar la condición de los jobs pesados a push a `main` (commit `9ad1990`)
- [x] T015 En `.github/workflows/ci.yml`: extraer la integración del frontend a su propio job `frontend-heavy`, con build previo del backend (commits `60eeb2c` y `8e8a543`)
- [x] T016 En `.github/workflows/ci.yml`: condicionar el job `sonarqube` con la misma `if:` que los jobs pesados, para que un push a una rama solo corra los perfiles unitarios (FR-005, FR-010)
- [x] T017 Actualizar `spec.md`, `plan.md`, `research.md`, `data-model.md` y `quickstart.md` para que reflejen el estado real del workflow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar de inmediato
- **Phase 3 (US1+US2)**: Depende del Setup; T005 → T006 → T007 en secuencia (mismo archivo)
- **Phase 4 (US3)**: Depende de Phase 3 completa
- **Polish (Phase 5)**: Depende de Phase 3 completa; T010/T011/T012 son paralelos entre sí

### User Story Dependencies

- **US1 + US2 (P1)**: Implementadas juntas en T005–T007 (mismo archivo, misma PR)
- **US3 (P2)**: Verificación posterior a US1+US2

### Within Each Phase

- T005 → T006 → T007: secuencia obligatoria (el job `backend-heavy` referencia el setup del job previo)
- T008 y T009: paralelos entre sí

---

## Parallel Example: Phase 3

```bash
# T005, T006, T007 son secuenciales (mismo archivo):
T005: Renombrar job backend → backend-unit, quitar steps pesados
T006: Agregar job backend-heavy con condición PR a main
T007: Agregar step frontend test:integration dentro de backend-heavy

# T010, T011, T012 son paralelos (validación local independiente):
T010: pnpm test:unit  (backend, sin contenedores)
T011: pnpm test:integration  (backend, con Testcontainers)
T012: pnpm test:e2e  (backend, con Testcontainers)
```

---

## Implementation Strategy

### MVP (US1 + US2 — el cambio real)

1. Completar Phase 1: auditoría de estado actual
2. Ejecutar T005 → T006 → T007: dividir el job en `ci.yml`
3. **STOP y VALIDAR**: hacer push a rama feature → verificar que solo corre `backend-unit`
4. Abrir PR a main → verificar que corre `backend-heavy` también

### Incremento adicional (US3)

5. Ejecutar T008 y T009: confirmar integridad de tests
6. Ejecutar Polish (T010–T012): validación local de cada perfil

---

## Notes

- [P] tasks = archivos distintos o validaciones independientes, sin dependencias entre sí
- [US1][US2] juntos en T005–T007 porque el cambio es un único diff atómico en `ci.yml`
- No hay código de aplicación, entidades, ni tests nuevos — toda la implementación es configuración YAML
- Constitución IX garantizada: T008 y T009 verifican explícitamente que ningún test fue tocado
