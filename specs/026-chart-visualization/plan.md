# Implementation Plan: Visualización gráfica de datos clave

**Branch**: `026-chart-visualization` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-chart-visualization/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Incorporar Recharts como única librería de gráficos del frontend, reemplazando dos gráficos SVG/CSS hechos a mano (evolución de cotización de jugador, evolución de capital de portfolio) por equivalentes basados en Recharts sin alterar los datos mostrados, y agregando tres gráficos nuevos (composición de la estrategia activa, profundidad del libro de órdenes, distribución del portfolio) sobre datos ya disponibles en el frontend o ya expuestos por el backend. No se agregan endpoints ni lógica de negocio nueva.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), React 19

**Primary Dependencies**: Recharts (nueva), React Router, Tailwind CSS 4 — sin cambios en el resto del stack

**Storage**: N/A (feature puramente de frontend; no toca persistencia ni contratos de API)

**Testing**: Vitest + React Testing Library (componentes de gráfico y página); tests unitarios puros para la función utilitaria de agrupamiento del order book (sin red, sin mocks)

**Target Platform**: Web responsivo (navegador), mismo target que el resto del frontend

**Project Type**: Web application (monorepo `backend/` + `frontend/`); esta feature solo toca `frontend/`

**Performance Goals**: Sin metas de performance específicas más allá de las ya vigentes para la UI; el agrupamiento del order book en cliente se acepta sin optimizar para volúmenes grandes (ver spec, riesgo aceptado)

**Constraints**: Los gráficos reemplazados MUST mostrar exactamente los mismos datos que la implementación anterior (FR-002, FR-003); ningún gráfico agrega llamadas nuevas a endpoints (FR-007); no hay actualización en tiempo real (FR-010)

**Scale/Scope**: 2 componentes de gráfico reemplazados, 3 componentes de gráfico nuevos, 1 función utilitaria pura nueva, 1 dependencia nueva (Recharts) en `frontend/package.json`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (Frontend, capas)**: los gráficos son componentes de presentación (`components/`), consumen datos ya resueltos por `hooks/`/`pages/` vía `service/`; ningún gráfico hace llamadas HTTP propias. La función de agrupamiento del order book es una función pura en `utils/`, sin acceso a red. **PASS**.
- **Principio II (Dominio rico)**: no aplica — no hay lógica de negocio nueva, solo transformación de datos ya calculados para visualización (agrupar por nivel de precio, calcular proporciones). **PASS** (no se introduce cálculo de negocio en el frontend).
- **Principio IX (Testing)**: la función utilitaria de agrupamiento de order book, por ser pura, MUST tener tests unitarios directos sin red (casos felices y borde: sin órdenes, un solo nivel, niveles mixtos). Los componentes de gráfico MUST tener tests de componente (Vitest + RTL) verificando que renderizan los mismos datos que antes. **PASS**, aplicado en tasks.
- **Principio X (Definición de terminado)**: feature de frontend puro, sin endpoints nuevos → no aplica actualizar Swagger ni Postman. Sí aplica: tests de componentes en verde y `vite build` sin errores. **PASS**.
- **Principio XI (Idioma)**: identificadores en inglés, mensajes/labels de UI en español, consistente con los componentes existentes (`QuoteHistoryChart`, `PortfolioEvolutionChart`, `OrderBookView`). **PASS**.
- **Principio XII (Spec-first)**: spec ya creada y validada (`specs/026-chart-visualization/spec.md`) antes de este plan. **PASS**.

Sin violaciones; no se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/026-chart-visualization/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: la feature no agrega ni modifica endpoints del backend (FR-007); todos los
gráficos consumen datos ya expuestos o ya resueltos en el frontend.

### Source Code (repository root)

```text
frontend/
├── package.json                          # se agrega la dependencia "recharts"
├── src/
│   ├── components/
│   │   ├── QuoteHistoryChart.tsx          # MODIFICADO: reimplementado con Recharts (mismos datos/props)
│   │   ├── QuoteHistoryChart.spec.tsx     # MODIFICADO: mismas aserciones de datos, selectores adaptados
│   │   ├── PortfolioEvolutionChart.tsx    # MODIFICADO: reimplementado con Recharts (mismos datos/props)
│   │   ├── PortfolioEvolutionChart.spec.tsx # MODIFICADO
│   │   ├── OrderBookView.tsx              # MODIFICADO: agrega el gráfico de profundidad junto a las columnas existentes
│   │   ├── OrderBookView.spec.tsx         # MODIFICADO
│   │   ├── OrderBookDepthChart.tsx        # NUEVO: gráfico de profundidad (Recharts)
│   │   ├── OrderBookDepthChart.spec.tsx   # NUEVO
│   │   ├── StrategyCompositionChart.tsx   # NUEVO: gráfico de barras de pesos de la estrategia activa
│   │   ├── StrategyCompositionChart.spec.tsx # NUEVO
│   │   ├── StrategiesPanel.tsx            # MODIFICADO: inserta StrategyCompositionChart para la estrategia seleccionada
│   │   ├── PortfolioDistributionChart.tsx # NUEVO: gráfico de torta/dona de distribución del portfolio
│   │   ├── PortfolioDistributionChart.spec.tsx # NUEVO
│   │   └── HoldingList.tsx                # MODIFICADO: inserta PortfolioDistributionChart como complemento de la tabla
│   ├── pages/
│   │   ├── PlayerDetailPage.tsx           # sin cambios de lógica; consume los componentes ya modificados
│   │   └── PortfolioPage.tsx              # sin cambios de lógica; consume los componentes ya modificados
│   ├── utils/
│   │   ├── orderBookDepth.ts              # NUEVO: función pura de agrupamiento de órdenes por nivel de precio
│   │   └── orderBookDepth.spec.ts         # NUEVO: tests unitarios puros (sin red)
│   └── types/
│       └── orders.types.ts                # sin cambios de contrato; se reutiliza OrderBookResponseDto existente
```

**Structure Decision**: Monorepo existente (`backend/` + `frontend/`); esta feature es exclusivamente
frontend. Se respeta la organización por capas del Principio I: la nueva función de agrupamiento vive en
`utils/` (pura, sin red); los gráficos son `components/` de presentación que reciben datos ya resueltos
por sus páginas/hooks; no se crean ni modifican `service/`, `hooks/` ni `contexts/`, porque ningún gráfico
requiere una llamada HTTP nueva.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No aplica — el Constitution Check no reportó violaciones.
