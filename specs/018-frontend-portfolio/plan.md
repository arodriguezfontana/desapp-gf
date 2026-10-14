# Implementation Plan: Frontend — Portfolio personal

**Branch**: `018-frontend-portfolio` | **Date**: 2026-10-14 | **Spec**: [specs/018-frontend-portfolio/spec.md](file:///c:/Users/arodr/OneDrive/Desktop/Archivos/Universidad/Repos/desapp-gf/specs/018-frontend-portfolio/spec.md)

**Input**: Feature specification from `specs/018-frontend-portfolio/spec.md`

## Summary

Implementar la vista privada de **Portfolio personal** en la aplicación web frontend. La vista consume el endpoint `GET /users/:id/portfolio` y opera como un snapshot estático de solo lectura en el momento de la carga de la página (sin polling). Se divide en dos secciones principales:
1. **Resumen Global**: Tarjetas con el capital total invertido, el valor actual consolidado de la cartera y la ganancia/pérdida neta acumulada (con diferenciación visual en color secondary `#6ab547` para ganancias y rojo Tailwind para pérdidas).
2. **Detalle de Posiciones (Holdings)**: Grilla/listado donde cada posición refleja el futbolista, tokens poseídos, precio medio ponderado de compra, cotización actual y resultado financiero individual.
3. **Estado de cartera vacía**: Presenta un mensaje amigable con botón de llamada a la acción (CTA) que conduce al catálogo de jugadores (`/catalog`).

La solución se estructura respetando rigurosamente la separación por capas de la Constitución: `types/portfolio.ts`, `service/portfolioService.ts`, `hooks/usePortfolio.ts`, `pages/PortfolioPage.tsx` y los componentes de presentación `components/PortfolioSummary.tsx` y `components/HoldingList.tsx`, integrándose en el router bajo `ProtectedRoute` y en la navegación de `AppLayout.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict mode), Node.js 20

**Primary Dependencies**: React 19, `react-router-dom` 7, Tailwind CSS 4, Vitest, React Testing Library

**Storage**: `localStorage` (gestión de sesión JWT mediante `authStorage` existente), PostgreSQL en backend

**Testing**: Vitest + React Testing Library (tests unitarios y de componentes), Testcontainers con PostgreSQL efímero y app NestJS real (`frontend/test/portfolio.spec.ts`)

**Target Platform**: Navegadores web modernos (diseño responsivo para escritorio y móviles)

**Project Type**: Single-Page Web Application (Frontend en monorepo)

**Performance Goals**: Carga y renderizado inicial de métricas y posiciones en menos de 2 segundos en condiciones de red estándar

**Constraints**:
- Capas estrictas en `frontend/src/` (`service/` único acceso a red, `hooks/` invocan servicios, `components/` solo presentación).
- Operación en snapshot sin consultas en segundo plano (polling deshabilitado).
- Paleta visual con secondary `#6ab547` para rendimientos positivos, rojo Tailwind para pérdidas y títulos pesados en mayúsculas (`font-black`, `uppercase`).
- Protección de ruta con redirección automática a `/login` ante sesiones ausentes o vencidas (401).

**Scale/Scope**: 1 ruta privada (`/portfolio`), 1 módulo de servicio (`portfolioService.ts`), 1 custom hook (`usePortfolio.ts`), 1 vista de página (`PortfolioPage.tsx`), 2 componentes reutilizables (`PortfolioSummary.tsx`, `HoldingList.tsx`), enlace en `AppLayout.tsx`, más suite de tests unitarios, de componentes y de integración con Testcontainers.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (Arquitectura en capas)**: PASS. La implementación frontend aísla las llamadas HTTP dentro de `service/portfolioService.ts`. Los componentes de UI nunca invocan `fetch` ni `httpClient` de forma directa; lo hacen a través del hook `usePortfolio.ts`.
- **Principio III (Cada validación en su nivel)**: PASS. Tipado fuerte en `types/portfolio.ts`, manejo centralizado de errores con evento 401 que dispara desautenticación en `AuthContext` y mensaje de alerta amigable para otros errores.
- **Principio IV (Autenticación)**: PASS. La ruta `/portfolio` se protege mediante `ProtectedRoute`. El token JWT se inyecta de forma transparente en las cabeceras `Authorization: Bearer <token>` a través de `httpClient`.
- **Principio IX (Testing)**: PASS.
  - Tests unitarios directos para `service/portfolioService.spec.ts` testeando contra mocks de `fetch`.
  - Tests unitarios directos para `hooks/usePortfolio.spec.ts`.
  - Tests de componentes aislados (`PortfolioSummary.spec.tsx`, `HoldingList.spec.tsx`) co-ubicados junto a sus archivos.
  - Test de integración contra backend real (`frontend/test/portfolio.spec.ts`) corriendo contra NestJS y PostgreSQL efímero de Testcontainers sin mockear API ni base de datos.
- **Principio X (Definición de terminado)**: PASS. Plan incluye validación de tests unitarios, componentes, integración con Testcontainers y verificación de `vite build`.
- **Principio XI (Idioma)**: PASS. Identificadores en inglés (`Holding`, `PortfolioSummary`, `usePortfolio`), interfaz de usuario, mensajes y documentación en español.
- **Principio XII (Spec-first)**: PASS. La especificación en `specs/018-frontend-portfolio/spec.md` fue completada y validada antes de diseñar este plan.

## Project Structure

### Documentation (this feature)

```text
specs/018-frontend-portfolio/
├── spec.md              # Requisitos funcionales y criterios de aceptación
├── plan.md              # Este documento de planificación técnica y arquitectura
├── research.md          # Decisiones técnicas y justificaciones (Fase 0)
├── data-model.md        # Definición de interfaces TypeScript y reglas de transformación (Fase 1)
├── quickstart.md        # Guía de ejecución y validación automatizada / manual (Fase 1)
├── contracts/           # Definición de contratos HTTP
│   └── portfolio-api.md # Contrato de GET /users/:id/portfolio
└── checklists/
    └── requirements.md  # Checklist de validación de calidad de la especificación
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── types/
│   │   └── portfolio.ts                  # Holding, PortfolioSummary, PortfolioResponse
│   ├── service/
│   │   ├── portfolioService.ts           # Cliente HTTP del portfolio (GET /users/:id/portfolio)
│   │   └── portfolioService.spec.ts      # Unit tests de servicio mockeando fetch
│   ├── hooks/
│   │   ├── usePortfolio.ts               # Hook de orquestación de estado, carga y errores
│   │   └── usePortfolio.spec.ts          # Unit tests directos del hook
│   ├── components/
│   │   ├── PortfolioSummary.tsx          # Tarjetas de resumen global (Invertido, Actual, Ganancia/Pérdida)
│   │   ├── PortfolioSummary.spec.tsx     # Tests de componente aislados
│   │   ├── HoldingList.tsx               # Grilla o listado de posiciones individuales
│   │   └── HoldingList.spec.tsx          # Tests de componente aislados
│   ├── pages/
│   │   └── PortfolioPage.tsx             # Vista de ruta del portfolio
│   ├── layout/
│   │   └── AppLayout.tsx                 # Incorporación del enlace a Portfolio en la navegación autenticada
│   └── routes/
│       └── router.tsx                    # Registro de /portfolio dentro de ProtectedRoute
└── test/
    └── portfolio.spec.ts                 # Test de integración contra backend real y Testcontainers
```

**Structure Decision**: Monorepo con aplicación web en `frontend/` y servicio en `backend/`. El desarrollo de esta feature se concentra en `frontend/src/` siguiendo la estricta organización por capas requerida por la Constitución (Principio IX y Estructura Frontend), ubicando los tests de integración contra backend real en `frontend/test/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *Ninguna* | No aplica | No existen violaciones a la arquitectura ni a la Constitución |
