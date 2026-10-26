# Research: Perfiles de ejecución de tests (022)

## Convención de nombre ya establecida en el repo

**Decision**: La convención ya existe y es consistente en todo el proyecto.

| Perfil | Patrón de archivo | Ubicación |
|--------|-------------------|-----------|
| Unitario | `*.spec.ts` (excluye `*.integration.spec.ts`) | `backend/src/**` |
| Integración | `*.integration.spec.ts` | `backend/src/**` |
| E2E | `*.e2e-spec.ts` | `backend/test/**` |
| Frontend unitario | archivos bajo `src/` con Vitest | `frontend/src/**` |

**Rationale**: No se requiere ningún cambio de nombre de archivo. Todos los tests existentes ya siguen el patrón.

---

## Estado actual de los scripts npm (backend)

**Decision**: Ya existen y funcionan correctamente.

```json
"test:unit":        "jest --runInBand --selectProjects unit"
"test:integration": "jest --runInBand --selectProjects integration"
"test:e2e":         "jest --runInBand --config ./test/jest-e2e.json"
```

La configuración de Jest `projects` en `package.json` ya separa:
- proyecto `unit`: `testMatch: ["**/*.spec.ts"]` + `testPathIgnorePatterns: ["\\.integration\\.spec\\.ts$"]`
- proyecto `integration`: `testMatch: ["**/*.integration.spec.ts"]`

El e2e usa `jest-e2e.json` con `testRegex: "\\.e2e-spec\\.ts$"`.

**Rationale**: No se modifica `package.json` del backend. Los scripts ya están listos.

---

## Estado actual de los scripts npm (frontend)

**Decision**: Ya existen y funcionan correctamente.

```json
"test:unit":        "vitest run --reporter=verbose --config vitest.config.ts"
"test:integration": "vitest run --reporter=verbose --config vitest.integration.config.ts"
```

**Rationale**: No se modifica `package.json` del frontend.

---

## Gap identificado: el CI no separa perfiles por evento

**Decision**: El único cambio real de esta feature está en `.github/workflows/ci.yml`.

**Situación actual**: el job `backend` corre los tres perfiles (unit + integration + e2e) en **todo evento** (push a cualquier rama, PR a main o dev). Esto viola el trade-off deseado: feedback rápido en push, suite completa solo en PR a main.

**Cambio requerido**:
- Separar el job `backend` en dos jobs (o usar condiciones `if:` sobre los steps):
  - **backend-unit**: corre en todo push + todo PR (lint + test:unit + build)
  - **backend-heavy**: corre solo en `pull_request` con base `main` o `push` a `main` (test:integration + test:e2e)

**Alternatives considered**:
- `if:` condicional sobre steps dentro del mismo job: más compacto pero el job entero tarda igual en pushes de rama (los steps de integración/e2e se saltean pero el job igual se encola y ocupa runner). Preferible dos jobs separados para paralelizar y visibilizar el estado.
- Dos workflows separados (`ci-unit.yml` + `ci-heavy.yml`): más claro conceptualmente pero duplica la configuración de checkout/pnpm/node. Un único `ci.yml` con dos jobs es suficiente.

---

## Impacto sobre el job SonarCloud

**Decision**: el job `sonarqube` ejecuta la suite completa (unit + integration + e2e con coverage) y por eso sigue la **misma condición `if:`** que `backend-heavy` y `frontend-heavy`: PR contra `main` o push a `main`.

**Rationale**: la primera versión de esta feature lo dejó sin condición, con el argumento de que SonarCloud necesita cobertura completa. El efecto fue que en cada push a una rama corrían igual integración y e2e (dentro de ese job), contradiciendo FR-005 y SC-001. Como el análisis de calidad solo importa al integrar a `main`, se le aplicó la misma condición que a los perfiles pesados.

**Trade-off aceptado**: no se analizan pushes a ramas ni PRs contra `dev`.

**Alternatives considered**: ejecutar Sonar siempre pero con alcance reducido (solo unit) en eventos livianos. Se descartó: la cobertura que vería Sonar sería baja y engañosa, y `test:cov` del backend corre unit e integración juntos, así que habría que cambiar los scripts.

---

## Impacto sobre el job frontend

**Decision**: el job `frontend` corre solo `test:unit` (más lint y build) en todo evento. La integración del frontend (`test:integration`) corre en el job `frontend-heavy`, con la misma condición que `backend-heavy`; ese job construye antes el backend porque los tests de integración del frontend lo levantan.

**Rationale**: la primera versión de esta investigación decía que el perfil pesado del frontend "no estaba wired en el workflow". Se cableó en esta misma feature (commits `8e8a543` y `60eeb2c`) como job propio, para que el build del backend no atrase al resto.
