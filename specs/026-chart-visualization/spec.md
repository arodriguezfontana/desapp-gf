# Feature Specification: Visualización gráfica de datos clave

**Feature Branch**: `026-chart-visualization`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Visualización gráfica de datos clave — incorporar una librería de gráficos (Recharts), reemplazar los gráficos hechos a mano (cotización de un jugador, capital del portfolio) por implementaciones basadas en esa librería sin cambiar los datos, y agregar gráficos nuevos donde hoy solo hay tablas/números: composición de la estrategia activa, profundidad del libro de órdenes del jugador, y distribución del portfolio por jugador."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver la evolución de cotización y de capital con gráficos consistentes (Priority: P1)

Como usuario, al entrar a la ficha de un jugador y a mi portfolio, quiero seguir viendo la evolución histórica de la cotización del jugador y de mi capital total, ahora con una presentación visual consistente entre ambas pantallas, para poder leerlas con el mismo lenguaje visual en toda la app.

**Why this priority**: Son los dos gráficos que ya existen y se usan activamente; migrarlos primero valida que la librería nueva puede reemplazar los gráficos hechos a mano sin pérdida de información ni de funcionalidad, antes de construir gráficos nuevos sobre la misma base.

**Independent Test**: Se puede probar entrando a la ficha de un jugador con historial de cotización y al portfolio con historial de capital, y verificando que los valores, fechas y tendencias mostradas coinciden exactamente con los que mostraban los gráficos anteriores.

**Acceptance Scenarios**:

1. **Given** un jugador con historial de cotizaciones, **When** el usuario abre su ficha, **Then** ve un gráfico de línea con la evolución de la cotización en el tiempo, mostrando los mismos puntos de datos (fecha y valor) que mostraba antes.
2. **Given** un usuario con historial de valuaciones de portfolio, **When** abre su portfolio, **Then** ve un gráfico de línea con la evolución de su capital total en el tiempo, mostrando los mismos puntos de datos que mostraba antes.
3. **Given** un jugador o portfolio sin historial suficiente, **When** se abre la vista correspondiente, **Then** el gráfico muestra un estado vacío o de datos insuficientes equivalente al que mostraba la implementación anterior.

---

### User Story 2 - Entender la composición de la estrategia de valuación activa (Priority: P2)

Como usuario, quiero ver de un vistazo los pesos que mi estrategia activa le asigna a cada factor de valuación, para entender por qué la cotización de un jugador es la que es, sin tener que interpretar una tabla de números.

**Why this priority**: Es información que hoy existe pero solo como números sueltos; agregarle visualización mejora la comprensión sin requerir nueva lógica de negocio, y es independiente de los gráficos ya existentes.

**Independent Test**: Se puede probar teniendo una estrategia de valuación activa con pesos configurados y verificando que el gráfico muestra cada factor con una proporción visual acorde a su peso configurado, sumando el 100% del total.

**Acceptance Scenarios**:

1. **Given** una estrategia de valuación activa con pesos configurados por factor, **When** el usuario la visualiza, **Then** ve un gráfico que representa la proporción de cada factor respecto del total de la estrategia.
2. **Given** un factor con peso configurado en cero, **When** se muestra el gráfico, **Then** ese factor aparece representado con proporción nula (no se omite silenciosamente ni rompe la visualización).

---

### User Story 3 - Visualizar la profundidad del libro de órdenes de un jugador (Priority: P2)

Como usuario, quiero ver gráficamente cómo se agrupan las órdenes de compra y venta pendientes de un jugador por nivel de precio, para identificar rápidamente en qué precios hay más concentración de interés de compra o de venta.

**Why this priority**: Hoy esta información se muestra como listas/tablas (ver columnas de Compras y Ventas); un gráfico de profundidad es el complemento natural y es una de las piezas centrales pedidas en el alcance.

**Independent Test**: Se puede probar abriendo la ficha de un jugador con órdenes de compra y venta activas en distintos niveles de precio y verificando que el gráfico agrupa correctamente el volumen por nivel de precio, diferenciando compras de ventas.

**Acceptance Scenarios**:

1. **Given** un jugador con órdenes de compra y venta activas en varios niveles de precio, **When** el usuario abre su ficha, **Then** ve un gráfico de profundidad que agrupa el volumen de órdenes por nivel de precio, distinguiendo visualmente compras de ventas.
2. **Given** un jugador sin órdenes activas, **When** se muestra el gráfico, **Then** se presenta un estado vacío equivalente al que ya existe en la vista tabular actual.

---

### User Story 4 - Ver la distribución del portfolio por jugador (Priority: P3)

Como usuario, quiero ver qué proporción de mi cartera representa cada jugador que tengo en tenencia, como complemento visual a la tabla de posiciones, para identificar de un vistazo mi grado de concentración o diversificación.

**Why this priority**: Es un agregado de valor sobre información ya existente (la tabla de posiciones), no reemplaza nada ni es bloqueante para las otras historias; se prioriza último por ser el de menor criticidad funcional.

**Independent Test**: Se puede probar teniendo posiciones en varios jugadores dentro del portfolio y verificando que el gráfico de distribución refleja la proporción de valor de cada jugador sobre el valor total de la cartera, consistente con la tabla de posiciones.

**Acceptance Scenarios**:

1. **Given** un portfolio con posiciones en múltiples jugadores, **When** el usuario lo visualiza, **Then** ve un gráfico que representa la proporción de valor de cada jugador sobre el valor total de la cartera.
2. **Given** un portfolio sin posiciones, **When** se muestra la vista, **Then** se presenta un estado vacío equivalente al que ya existe en la tabla de posiciones.

### Edge Cases

- ¿Qué pasa si un jugador tiene un único punto de cotización histórica? El gráfico de línea debe poder renderizarse igual (aunque sea un único punto), sin error.
- ¿Qué pasa si hay muchos niveles de precio distintos en el libro de órdenes? Se agrupan todos en el cliente sin paginación ni límite, asumiendo volumen manejable (fuera de alcance optimizar para volúmenes grandes).
- ¿Qué pasa si los pesos de la estrategia activa no suman exactamente 100% por redondeo? El gráfico muestra las proporciones tal como vienen de los datos existentes, sin normalizar ni corregir.
- ¿Qué pasa si el usuario tiene una sola posición en el portfolio? El gráfico de distribución debe mostrar esa única porción representando el 100%.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST incorporar una única librería de gráficos (Recharts) para toda visualización gráfica nueva y para las que se migran, evitando que convivan dos enfoques distintos (hecho a mano vs. librería) en el frontend.
- **FR-002**: El sistema MUST reemplazar la implementación del gráfico de evolución de cotización de un jugador por una versión basada en la librería de gráficos, preservando exactamente los mismos datos mostrados (puntos, fechas, valores) que la implementación anterior.
- **FR-003**: El sistema MUST reemplazar la implementación del gráfico de evolución del capital total del portfolio por una versión basada en la librería de gráficos, preservando exactamente los mismos datos mostrados que la implementación anterior.
- **FR-004**: El sistema MUST agregar un gráfico de composición de la estrategia de valuación activa del usuario, mostrando el peso configurado de cada factor sobre el total.
- **FR-005**: El sistema MUST agregar un gráfico de profundidad del libro de órdenes en la ficha del jugador, agrupando el volumen de órdenes de compra y venta pendientes por nivel de precio, distinguiendo visualmente ambos lados.
- **FR-006**: El sistema MUST agregar un gráfico de distribución del portfolio, mostrando la proporción del valor total de la cartera que representa cada jugador en tenencia del usuario, como complemento de la tabla de posiciones existente (sin reemplazarla).
- **FR-007**: Ninguno de los gráficos nuevos o migrados MUST introducir lógica de negocio, cálculos o transformaciones de datos que no existan ya en el sistema o en el frontend; todos consumen información ya expuesta o ya disponible en el cliente.
- **FR-008**: Cada gráfico MUST mostrar un estado vacío o equivalente cuando no hay datos suficientes para graficar (sin historial, sin órdenes activas, sin posiciones, etc.), consistente con el comportamiento ya existente en esas vistas.
- **FR-009**: El agrupamiento del libro de órdenes por nivel de precio MUST realizarse en el cliente, sin paginación ni límite de volumen, asumiendo un volumen de órdenes manejable.
- **FR-010**: Los gráficos MUST recalcularse al volver a consultar la vista (navegación o refresco), sin requerir actualización en tiempo real ante cambios del lado del servidor.

### Key Entities

- **Historial de cotización de jugador**: serie de puntos (fecha, valor de cotización) ya expuesta por el sistema; consumida sin cambios por el gráfico de evolución de cotización.
- **Historial de capital de portfolio**: serie de puntos (fecha, valor total) ya expuesta por el sistema; consumida sin cambios por el gráfico de evolución de capital.
- **Estrategia de valuación activa**: conjunto de factores con un peso configurado cada uno, ya disponible en el frontend; consumida por el gráfico de composición de estrategia.
- **Libro de órdenes del jugador**: conjunto de órdenes de compra y venta pendientes, cada una con precio y cantidad, ya expuesto por el sistema; agrupado en el cliente por nivel de precio para el gráfico de profundidad.
- **Posiciones del portfolio**: conjunto de tenencias del usuario por jugador, cada una con un valor de mercado, ya disponible en el frontend; consumida por el gráfico de distribución del portfolio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los datos mostrados en los gráficos migrados (cotización de jugador, capital de portfolio) coincide exactamente con los datos mostrados por la implementación anterior, verificado en los mismos escenarios de prueba.
- **SC-002**: Un usuario puede identificar, sin leer números, cuál es el factor con mayor peso en su estrategia activa en menos de 5 segundos de observar el gráfico de composición.
- **SC-003**: Un usuario puede identificar, sin leer la tabla, en qué nivel de precio se concentra la mayor parte del volumen de compra o de venta de un jugador en menos de 5 segundos de observar el gráfico de profundidad.
- **SC-004**: Un usuario puede identificar su jugador de mayor concentración en el portfolio en menos de 5 segundos de observar el gráfico de distribución.
- **SC-005**: Toda nueva superficie de gráficos del frontend (migrada o agregada) usa una única librería, verificado por la ausencia de implementaciones de gráficos hechas a mano en el código luego de completada la feature.

## Assumptions

- Recharts es la librería de gráficos a incorporar, según decisión de diseño ya tomada; no se evalúan alternativas.
- No se requiere actualización de los gráficos en tiempo real ante cambios en el servidor; se recalculan al volver a consultar la vista (aceptado como riesgo fuera de alcance).
- El agrupamiento del libro de órdenes por nivel de precio no requiere paginación ni límite de volumen; se asume un volumen manejable para procesar en el cliente (aceptado como riesgo fuera de alcance).
- Los datos consumidos por todos los gráficos (cotización, capital, estrategia, libro de órdenes, posiciones de portfolio) ya están expuestos por el backend o ya disponibles en el frontend; no se requieren nuevos endpoints ni cambios de contrato de datos.
- El gráfico de distribución del portfolio complementa la tabla de posiciones existente; no la reemplaza.
