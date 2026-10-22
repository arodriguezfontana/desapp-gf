---
description: "Task list template for feature implementation"
---

# Tasks: Visualización gráfica de datos clave

**Input**: Design documents from `/specs/026-chart-visualization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos. El Principio IX de la constitución exige tests unitarios directos para funciones
puras y tests de componente para UI; se generan como parte de cada historia, no como fase separada.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para permitir implementación y
prueba independiente de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: A qué historia de usuario pertenece (US1, US2, US3, US4)
- Todas las rutas son relativas a la raíz del repo

## Path Conventions

Monorepo `backend/` + `frontend/`; esta feature toca exclusivamente `frontend/src/`.

---

## Phase 1: Setup

**Purpose**: Incorporar la librería de gráficos antes de tocar cualquier componente.

- [X] T001 Agregar `recharts` como dependencia de `frontend/package.json` (`npm install recharts --workspace frontend` o `cd frontend && npm install recharts`) y confirmar que `package-lock.json` queda actualizado.
- [X] T002 Confirmar que `frontend/.gitignore` ya cubre `node_modules/`, `dist/` (no requiere cambios si ya están presentes; si falta alguno, agregarlo).

**Checkpoint**: `recharts` disponible para importar desde cualquier componente de `frontend/src/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: La función utilitaria de agrupamiento del order book es prerequisito del gráfico de
profundidad (US3); el resto de las historias no depende de infraestructura compartida adicional.

**⚠️ CRITICAL**: T003–T004 deben completarse antes de iniciar la implementación de US3.

- [X] T003 [P] Crear la función pura `buildOrderBookDepth(bids: OrderBookLevel[], asks: OrderBookLevel[]): OrderBookDepthPoint[]` en `frontend/src/utils/orderBookDepth.ts`, según el contrato de `data-model.md` (combina niveles ya agregados de bids/asks en una lista ordenada por precio, con `bidQuantity`/`askQuantity`, 0 del lado sin órdenes a ese precio).
- [X] T004 [P] Tests unitarios puros (sin red, sin mocks) en `frontend/src/utils/orderBookDepth.spec.ts`: libro vacío → `[]`; un único nivel solo de compra; un único nivel solo de venta; varios niveles con precios mixtos (algunos solo bid, algunos solo ask, algunos con ambos); orden ascendente por precio garantizado en la salida.

**Checkpoint**: `buildOrderBookDepth` lista y testeada; US3 puede implementarse.

---

## Phase 3: User Story 1 - Ver la evolución de cotización y de capital con gráficos consistentes (Priority: P1) 🎯 MVP

**Goal**: Reemplazar los dos gráficos hechos a mano (cotización de jugador, capital de portfolio) por
equivalentes en Recharts, sin cambiar los datos que muestran.

**Independent Test**: Abrir la ficha de un jugador con historial y el portfolio con historial de
transacciones, y verificar que los valores y fechas mostrados coinciden exactamente con los de la
implementación anterior.

### Implementation for User Story 1

- [X] T005 [P] [US1] Reimplementar `frontend/src/components/QuoteHistoryChart.tsx` usando `LineChart` de Recharts: mismas props (`quotes: PlayerQuote[]`, `color?`), misma deduplicación por día y mismo estado vacío ya existentes; tooltip de Recharts mostrando fecha, valor (moneda) y score, equivalente al tooltip SVG actual.
- [X] T006 [P] [US1] Reimplementar `frontend/src/components/PortfolioEvolutionChart.tsx` usando `AreaChart` de Recharts: misma prop (`transactions: TokenTransactionDto[]`), mismo cálculo de capital acumulado, misma línea de cero cuando hay valores negativos, mismo estado vacío, tooltip equivalente (fecha, jugador, cantidad, tipo de operación, capital neto acumulado) y leyenda Compra/Venta.
- [X] T007 [US1] Adaptar `frontend/src/components/QuoteHistoryChart.spec.tsx` a los nuevos selectores de Recharts, preservando las mismas aserciones de datos (valores, fechas, estado vacío) que el test anterior. (depende de T005)
- [X] T008 [US1] Adaptar `frontend/src/components/PortfolioEvolutionChart.spec.tsx` a los nuevos selectores de Recharts, preservando las mismas aserciones de datos (capital neto, puntos por transacción, estado vacío). (depende de T006)
- [X] T009 [US1] Verificar manualmente (Escenarios 1 y 2 de `quickstart.md`) que `frontend/src/pages/PlayerDetailPage.tsx` y `frontend/src/pages/PortfolioPage.tsx` siguen renderizando ambos gráficos sin cambios de props ni de datos. (depende de T005, T006)

**Checkpoint**: Ambos gráficos reemplazados, con tests en verde y datos verificados idénticos a la
versión anterior.

---

## Phase 4: User Story 2 - Entender la composición de la estrategia de valuación activa (Priority: P2)

**Goal**: Agregar un gráfico de barras que muestre los pesos configurados de la estrategia activa del
usuario.

**Independent Test**: Con una estrategia activa con pesos configurados, verificar que el gráfico muestra
cada factor con una barra proporcional a su peso, incluyendo factores en cero.

### Implementation for User Story 2

- [X] T010 [P] [US2] Crear `frontend/src/components/StrategyCompositionChart.tsx`: recibe `weights: Record<string, number>` (de `UserStrategyResponseDto.weights` de la estrategia con `isSelected === true`) y renderiza un `BarChart` de Recharts con una barra por factor; incluye estado vacío si `weights` está vacío.
- [X] T011 [P] [US2] Tests de componente en `frontend/src/components/StrategyCompositionChart.spec.tsx`: renderiza una barra por cada clave de `weights`; un factor con peso `0` aparece representado (no se omite); estado vacío sin pesos configurados.
- [X] T012 [US2] Insertar `StrategyCompositionChart` en `frontend/src/components/StrategiesPanel.tsx`, pasándole `weights` de la estrategia con `isSelected === true` (si existe alguna seleccionada), junto a la lista de estrategias ya existente. (depende de T010)
- [X] T013 [US2] Adaptar `frontend/src/components/StrategiesPanel.spec.tsx` para cubrir la nueva inclusión del gráfico (se renderiza cuando hay una estrategia seleccionada; no rompe los tests existentes de selección/edición de pesos). (depende de T012)

**Checkpoint**: Gráfico de composición de estrategia visible y testeado, sin afectar la funcionalidad
existente de `StrategiesPanel`.

---

## Phase 5: User Story 3 - Visualizar la profundidad del libro de órdenes de un jugador (Priority: P2)

**Goal**: Agregar un gráfico de profundidad que agrupe por nivel de precio las órdenes de compra y venta
pendientes de un jugador.

**Independent Test**: Con un jugador con órdenes de compra y venta en varios niveles de precio, verificar
que el gráfico agrupa correctamente el volumen por nivel, distinguiendo compra de venta.

**Depends on**: Phase 2 (T003, T004).

### Implementation for User Story 3

- [X] T014 [US3] Crear `frontend/src/components/OrderBookDepthChart.tsx`: recibe `bids: OrderBookLevel[]`, `asks: OrderBookLevel[]`, usa `buildOrderBookDepth` (T003) para obtener los puntos y renderiza un `BarChart`/`AreaChart` de dos series (compra en verde esmeralda, venta en rojo/rosa, consistente con los colores ya usados en `OrderBookView`); estado vacío cuando ambos arrays están vacíos.
- [X] T015 [P] [US3] Tests de componente en `frontend/src/components/OrderBookDepthChart.spec.tsx`: niveles mixtos de bid/ask se grafican en las series correctas; estado vacío sin órdenes; un solo lado con órdenes.
- [X] T016 [US3] Insertar `OrderBookDepthChart` en `frontend/src/components/OrderBookView.tsx`, pasándole `orderBook?.bids ?? []` y `orderBook?.asks ?? []`, junto a las columnas de Compras/Ventas ya existentes (sin reemplazarlas). (depende de T014)
- [X] T017 [US3] Adaptar `frontend/src/components/OrderBookView.spec.tsx` para cubrir la nueva inclusión del gráfico de profundidad, preservando los tests existentes de las columnas Compras/Ventas y del estado vacío. (depende de T016)

**Checkpoint**: Gráfico de profundidad visible en la ficha del jugador, agrupando correctamente por nivel
de precio, sin romper la vista tabular existente.

---

## Phase 6: User Story 4 - Ver la distribución del portfolio por jugador (Priority: P3)

**Goal**: Agregar un gráfico de torta/dona que muestre la proporción de valor de cada jugador en el
portfolio del usuario.

**Independent Test**: Con un portfolio con posiciones en varios jugadores, verificar que el gráfico
refleja la proporción de valor de cada jugador sobre el total, consistente con la tabla de posiciones.

### Implementation for User Story 4

- [X] T018 [P] [US4] Crear `frontend/src/components/PortfolioDistributionChart.tsx`: recibe `holdings: Holding[]`, calcula el valor de cada posición como `tokenQuantity * currentPrice` y renderiza un `PieChart` (modo dona) de Recharts con una porción por jugador; estado vacío cuando `holdings` está vacío.
- [X] T019 [P] [US4] Tests de componente en `frontend/src/components/PortfolioDistributionChart.spec.tsx`: una porción por holding, proporción calculada correctamente a partir de `tokenQuantity * currentPrice`; estado vacío sin posiciones; una única posición representa el 100%.
- [X] T020 [US4] Insertar `PortfolioDistributionChart` en `frontend/src/components/HoldingList.tsx`, pasándole `holdings`, como complemento visual junto a la tabla de posiciones ya existente (sin reemplazarla). (depende de T018)
- [X] T021 [US4] Adaptar `frontend/src/components/HoldingList.spec.tsx` para cubrir la nueva inclusión del gráfico de distribución, preservando los tests existentes de la tabla. (depende de T020)

**Checkpoint**: Las cuatro historias de usuario quedan funcionales de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de la feature conforme a la Definición de Terminado (Principio X).

- [X] T022 [P] Correr `npm run build` (`vite build`) en `frontend/` y confirmar que compila sin errores con `recharts` incorporado.
- [X] T023 [P] Correr la suite completa de Vitest en `frontend/` (`npm run test` / `vitest run`) y confirmar que todos los tests —nuevos y preexistentes adaptados— pasan en verde.
- [X] T024 Ejecutar manualmente los 5 escenarios de `specs/026-chart-visualization/quickstart.md` contra el entorno local y confirmar que cada uno se comporta según lo esperado.
- [X] T025 Revisar que ningún componente de gráfico hecho a mano (SVG/CSS propio) quede en `frontend/src/components/` fuera de los reemplazados por esta feature (SC-005 de la spec).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato.
- **Foundational (Phase 2)**: depende de Setup (necesita `recharts` instalado solo si se decide tipar o renderizar algo ahí, pero la función pura T003/T004 no depende de Recharts en sí). Bloquea Phase 5 (US3).
- **US1 (Phase 3)**: depende de Setup. Independiente de Foundational, US2, US3, US4.
- **US2 (Phase 4)**: depende de Setup. Independiente de Foundational, US1, US3, US4.
- **US3 (Phase 5)**: depende de Setup **y** Foundational (T003/T004). Independiente de US1, US2, US4.
- **US4 (Phase 6)**: depende de Setup. Independiente de Foundational, US1, US2, US3.
- **Polish (Phase 7)**: depende de que todas las historias que se vayan a entregar estén completas.

### Parallel Opportunities

- T001 y T002 en paralelo.
- T003 y T004 en paralelo entre sí (T004 solo puede darse por completo una vez escrita la función de T003, pero ambas tareas pueden abrirse en paralelo si se sigue TDD: tests primero, función después — en ese caso T004 antes de T003).
- Una vez completado Setup, **US1, US2, US3 (si Foundational ya está listo) y US4 pueden trabajarse en paralelo** por distintas personas, ya que tocan archivos de componentes distintos y no comparten estado.
- Dentro de cada historia, la tarea de creación de componente y su test pueden abrirse en paralelo si se sigue TDD estricto (test primero); se marcan [P] cuando son archivos distintos sin dependencia secuencial dura.

---

## Parallel Example: User Story 1

```bash
Task: "Reimplementar QuoteHistoryChart.tsx con Recharts"
Task: "Reimplementar PortfolioEvolutionChart.tsx con Recharts"
```

## Parallel Example: tras completar Setup

```bash
Task: "US1 - Reemplazar gráficos de cotización y capital"
Task: "US2 - Gráfico de composición de estrategia"
Task: "US4 - Gráfico de distribución de portfolio"
# US3 solo si Foundational (T003/T004) ya está completo
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup.
2. Completar Phase 3: User Story 1 (reemplazo de los dos gráficos existentes).
3. **STOP and VALIDATE**: correr Escenarios 1 y 2 de `quickstart.md` y los tests adaptados.
4. Esto ya demuestra que Recharts reemplaza los gráficos hechos a mano sin pérdida de datos — el corazón
   de la decisión de diseño de la feature.

### Incremental Delivery

1. Setup → Foundational (T003/T004) listos.
2. US1 (P1) → validar → es el MVP que prueba el reemplazo de librería.
3. US2 (P2) → validar → composición de estrategia.
4. US3 (P2) → validar → profundidad de order book (requiere Foundational).
5. US4 (P3) → validar → distribución de portfolio.
6. Polish (Phase 7) → cierre según Definición de Terminado.

### Parallel Team Strategy

Con varias personas: una completa Setup; luego cada una toma una historia (US1, US2, US3, US4) en
paralelo, ya que no comparten archivos de componente entre sí (US3 solo espera a que Foundational esté
listo).

---

## Notes

- [P] = archivos distintos, sin dependencia entre sí.
- [Story] mapea cada tarea a su historia de usuario para trazabilidad.
- Ningún endpoint nuevo: no hay tareas de backend en este tasks.md (FR-007 de la spec).
- No se modifica ni borra ningún test existente sin permiso explícito (Principio IX); las tareas de
  "adaptar spec de test" (T007, T008, T013, T017, T021) ajustan selectores por el cambio de
  implementación, preservando las mismas aserciones de datos — no se eliminan casos de prueba.
