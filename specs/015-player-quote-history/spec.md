# Feature Specification: Historial de Cotizaciones del Jugador

**Feature Branch**: `015-player-quote-history`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Historial de cotizaciones (GET /players/:id/quotes). El sistema permite consultar la evolución histórica de la cotización de un jugador. El endpoint devuelve todas las cotizaciones calculadas para ese jugador, ordenadas cronológicamente de más antigua a más reciente. Cada entrada incluye el valor resultante, el score, la referencia a la estrategia usada, el timestamp del cálculo, y si corresponde a un perfil de posición o a los pesos generales de la estrategia. Si el jugador no existe → 404. Si el jugador existe pero todavía no tiene cotizaciones calculadas → 200 con array vacío, no 404. No requiere paginación ni filtro por rango de fechas: el volumen de cotizaciones por jugador (una por semana) no lo justifica. En el frontend, la vista de detalle del jugador debe mostrar un gráfico de líneas con la evolución del valor en el tiempo, usando este endpoint como fuente de datos. El eje X es el timestamp de cada cotización, el eje Y es el valor resultante. Si el jugador no tiene cotizaciones todavía, se muestra un estado vacío en lugar del gráfico."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el historial completo de cotizaciones de un jugador (Priority: P1)

Cualquier consumidor autorizado puede pedir, para un jugador puntual, la lista completa de todas las cotizaciones que se le calcularon a lo largo del tiempo, ordenadas de la más antigua a la más reciente.

**Why this priority**: Es la capacidad central de la feature. Sin el endpoint, no hay datos sobre los cuales construir ninguna visualización de evolución; todo lo demás depende de esto.

**Independent Test**: Se puede testear de forma aislada pidiendo el historial de un jugador con varias cotizaciones calculadas (por ejemplo, tras varios recálculos con distintas estrategias activas) y verificando que la respuesta trae todas, en el orden correcto, con los campos esperados.

**Acceptance Scenarios**:

1. **Given** un jugador con tres cotizaciones calculadas en momentos distintos, **When** se consulta su historial, **Then** la respuesta trae las tres entradas ordenadas de la más antigua a la más reciente.
2. **Given** cada entrada del historial, **When** se inspecciona su contenido, **Then** incluye el valor resultante, el score, una referencia a la estrategia usada en ese cálculo, el timestamp del cálculo, y si esa cotización se calculó con el perfil de una posición o con los pesos generales de la estrategia.
3. **Given** un jugador que existe en el catálogo pero todavía no tiene ninguna cotización calculada, **When** se consulta su historial, **Then** la respuesta es exitosa (200) con una lista vacía, sin tratarse como un error.
4. **Given** un identificador que no corresponde a ningún jugador del catálogo, **When** se consulta su historial, **Then** la respuesta indica que el jugador no existe (404).
5. **Given** un jugador con una única cotización calculada, **When** se consulta su historial, **Then** la respuesta trae esa única entrada, sin error ni comportamiento especial por tratarse de un solo elemento.

---

### User Story 2 - Visualizar la evolución del valor de un jugador en un gráfico (Priority: P2)

En la ficha de detalle de un jugador, un usuario puede ver, de un vistazo, cómo evolucionó el valor de su token a lo largo del tiempo mediante un gráfico de líneas.

**Why this priority**: Es la forma en que el usuario final consume el historial; sin esta pieza el endpoint de la Historia 1 no le aporta nada a nadie que no use la API directamente. Depende de que el historial ya exista (Historia 1) para tener datos que graficar.

**Independent Test**: Se puede testear abriendo la ficha de un jugador con varias cotizaciones históricas (mockeando la respuesta del endpoint) y verificando que se renderiza un gráfico de líneas con un punto por cotización; y, por separado, abriendo la ficha de un jugador sin cotizaciones y verificando que se muestra un estado vacío en lugar de un gráfico.

**Acceptance Scenarios**:

1. **Given** un jugador con varias cotizaciones históricas, **When** se abre su ficha de detalle, **Then** se muestra un gráfico de líneas donde el eje X representa el momento de cada cotización y el eje Y representa el valor resultante de esa cotización.
2. **Given** un jugador con una sola cotización histórica, **When** se abre su ficha de detalle, **Then** se muestra el gráfico con un único punto, sin error.
3. **Given** un jugador sin ninguna cotización calculada todavía, **When** se abre su ficha de detalle, **Then** se muestra un estado vacío indicando que no hay historial, en lugar de un gráfico vacío o roto.

---

### Edge Cases

- ¿Qué sucede si se consulta el historial de un jugador que fue dado de baja del catálogo (soft-delete)? → Se trata igual que un jugador inexistente (404), consistente con el comportamiento ya existente de la consulta de cotización vigente (`GET /players/:id/quote`), que tampoco encuentra jugadores dados de baja.
- ¿Qué sucede si entre dos cotizaciones consecutivas de un jugador cambió la estrategia activa? → Ambas entradas aparecen en el historial, cada una con la referencia a la estrategia que realmente se usó en su propio cálculo (reproducibilidad histórica ya garantizada por el snapshot de `PlayerQuote`); el historial no oculta ni fusiona cambios de estrategia.
- ¿Qué sucede si dos cotizaciones del mismo jugador quedaron con el mismo timestamp (caso extremo, por ejemplo por un recálculo manual inmediatamente después de otro)? → El orden entre ellas no está garantizado por la especificación; alcanza con que el orden general sea ascendente por timestamp.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer una forma de consultar, para un jugador identificado, la lista completa de todas las cotizaciones calculadas para ese jugador.
- **FR-002**: El sistema MUST devolver las cotizaciones de un jugador ordenadas cronológicamente de la más antigua a la más reciente según su timestamp de cálculo.
- **FR-003**: Cada entrada del historial MUST incluir, como mínimo: el valor resultante, el score, una referencia a la estrategia usada en ese cálculo, el timestamp del cálculo, y un indicador de si esa cotización se calculó con el perfil de una posición o con los pesos generales de la estrategia (ver feature 014-position-weight-profiles).
- **FR-004**: Si el identificador no corresponde a ningún jugador existente, el sistema MUST responder indicando que el jugador no existe (404), sin devolver una lista (vacía o no).
- **FR-005**: Si el jugador existe pero no tiene ninguna cotización calculada todavía, el sistema MUST responder exitosamente con una lista vacía, nunca con un error de "no encontrado".
- **FR-006**: El sistema MUST NOT exigir paginación ni filtros de rango de fechas para esta consulta: la especificación asume un volumen bajo de cotizaciones por jugador (del orden de una por semana) que no lo justifica.
- **FR-007**: La consulta del historial MUST requerir la misma autenticación que ya rige para el resto de las consultas del catálogo de jugadores y de cotizaciones (clave de API), sin exponer este dato sin autenticar.
- **FR-008**: La vista de detalle de un jugador en el frontend MUST mostrar un gráfico de líneas con la evolución del valor del jugador en el tiempo, usando el historial de cotizaciones como fuente de datos: el eje X MUST representar el timestamp de cada cotización y el eje Y MUST representar su valor resultante.
- **FR-009**: Si el jugador no tiene ninguna cotización en su historial, la vista de detalle MUST mostrar un estado vacío explícito en lugar del gráfico (nunca un gráfico vacío, roto o sin datos silenciosamente).

### Key Entities

- **Historial de cotizaciones**: No es una entidad nueva — es la colección completa de `PlayerQuote` (entidad ya existente, ver 012-valuation-strategies y 014-position-weight-profiles) asociadas a un mismo jugador, expuesta como lista ordenada cronológicamente. Cada elemento conserva los mismos atributos que una `PlayerQuote` individual: valor, score, referencia a la estrategia, snapshot de los pesos usados, indicador de perfil de posición u pesos generales, y timestamp de cálculo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un consumidor autorizado puede obtener el historial completo de cotizaciones de cualquier jugador existente en una sola consulta, sin necesidad de paginar ni de conocer rangos de fechas de antemano.
- **SC-002**: El 100% de las cotizaciones devueltas en un historial aparecen en orden cronológico ascendente, verificable comparando cada timestamp con el de la entrada siguiente.
- **SC-003**: Un jugador sin cotizaciones calculadas todavía produce una respuesta exitosa con lista vacía, distinguible sin ambigüedad de la respuesta para un jugador inexistente (404).
- **SC-004**: Un usuario que abre la ficha de un jugador con historial puede ver la evolución de su valor en un gráfico sin realizar ninguna acción adicional; si el jugador no tiene historial, ve un mensaje claro en su lugar en el mismo tiempo que tardaría en ver el gráfico.

## Assumptions

- La referencia a la estrategia usada en cada entrada del historial es, como mínimo, el identificador de la estrategia (mismo dato que ya persiste `PlayerQuote.strategyId`); no se exige resolver y exponer además el nombre de la estrategia, aunque hacerlo no contradice esta especificación.
- Un jugador dado de baja del catálogo (soft-delete) se trata como inexistente a los fines de este endpoint, igual que ya ocurre hoy en `GET /players/:id/quote`.
- La autenticación y autorización de este endpoint reutilizan el mecanismo ya vigente para el resto de las consultas de catálogo y cotizaciones (clave de API), sin introducir un nuevo nivel de permisos.
- El volumen esperado de cotizaciones por jugador es bajo (una cotización por semana, según el job de recálculo semanal ya existente), por lo que devolver siempre la lista completa sin paginar no representa un riesgo de rendimiento conocido para el alcance actual del proyecto.
- El gráfico de líneas en el frontend es puramente informativo/de solo lectura: no permite interactuar para modificar datos, solo visualizar la evolución histórica.
