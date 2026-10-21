# Implementation Plan: Perfiles de ejecución de tests separados por costo

**Branch**: `022-test-execution-profiles` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-test-execution-profiles/spec.md`

## Summary

Separar el pipeline de CI en dos perfiles de ejecución: unitario (rápido, sin infraestructura) que corre en todo push, y pesado (integración + e2e, con Testcontainers) que corre solo en PRs contra main. Los scripts npm y la configuración Jest ya existen y están correctos; el único cambio es en `.github/workflows/ci.yml`.

## Technical Context

**Language/Version**: TypeScript 5.7 (backend), YAML (GitHub Actions)

**Primary Dependencies**: Jest 30 con projects (backend), Vitest (frontend), GitHub Actions

**Storage**: N/A — no hay cambios de esquema ni entidades nuevas

**Testing**: Jest `--selectProjects unit/integration` + `jest-e2e.json` para e2e (todos ya configurados)

**Target Platform**: GitHub Actions (ubuntu-latest runners con Docker disponible)

**Project Type**: Configuración de CI/CD — no hay código de aplicación

**Performance Goals**: Push a rama feature completa el job de CI en < 3 minutos sin levantar contenedores

**Constraints**: Ningún archivo de test existente puede modificarse (Constitución IX)

**Scale/Scope**: Un archivo de workflow modificado (`ci.yml`); ningún archivo de test tocado

## Constitution Check

| Principio | Aplica | Estado |
|-----------|--------|--------|
| IX. Testing — no modificar tests existentes | ✅ Sí | **PASS** — el plan no toca ningún archivo de test |
| IX. Testing — integración/e2e con Testcontainers en CI | ✅ Sí | **PASS** — `backend-heavy` sigue corriendo Testcontainers; no se introduce postgres como servicio del workflow |
| X. Definición de terminado — no aplica a feature sin endpoints | ➡ N/A | No hay endpoints nuevos ni UI |
| XI. Idioma | ✅ Sí | **PASS** — comentarios del workflow en español, nombres de jobs en inglés |

## Project Structure

### Documentation (this feature)

```text
specs/022-test-execution-profiles/
├── plan.md         ← este archivo
├── research.md     ← Phase 0 (completo)
├── data-model.md   ← Phase 1 (completo)
├── quickstart.md   ← Phase 1 (completo)
└── tasks.md        ← Phase 2 (/speckit-tasks — pendiente)
```

### Source Code (cambios reales)

```text
.github/
└── workflows/
    └── ci.yml      ← ÚNICO ARCHIVO MODIFICADO
```

El cambio consiste en dividir el job `backend` actual en dos:

```yaml
# Antes (un solo job, siempre corre todo):
jobs:
  backend:
    steps: [lint, test:unit, test:integration, test:e2e, build]

# Después (dos jobs con triggers diferentes):
jobs:
  backend-unit:
    # Corre en TODO push y PR (feedback rápido)
    steps: [lint, test:unit, build]

  backend-heavy:
    # Corre SOLO en pull_request targeting main
    if: github.event_name == 'pull_request' && github.base_ref == 'main'
    steps: [test:integration, test:e2e]
```

Los jobs `frontend` y `sonarqube` quedan sin cambios.

## Complexity Tracking

No hay violaciones de constitución. No se requiere justificación de complejidad adicional.
