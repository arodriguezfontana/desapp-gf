# Feature Specification: Extensión de Métricas de Jugador (WhoScored)

**Feature Branch**: `011-whoscored-player-metrics`

**Created**: 2026-10-07

**Status**: Ready for Planning

**Input**: User description: "Extensión de métricas de jugador (WhoScored). Agregar 7 campos de estadísticas al modelo Player que WhoScored ya expone pero no se persisten. Son prerequisito de la feature 012 (sistema de cotización). Campos nuevos con su nombre en el fixture WhoScored y su nombre en dominio: Goals → goals (entero), Assists → assists (entero), KeyPasses → keyPasses (entero), Dribbles → dribbles (entero), TotalTackles → totalTackles (entero), Yellow → yellowCards (entero), Red → redCards (entero). Todos son nullable: un jugador puede no tener dato en alguna métrica si no jugó o si WhoScored no lo reporta. La feature 012 tratará null como 0 al calcular el score. El adapter de WhoScored ya recorre los fixtures por jugador; solo debe mapear estos 7 campos adicionales al domain Player. No cambia la lógica de scraping ni los endpoints de disparo (sync-trigger). El mapper, la entidad, la migración y el DTO de respuesta deben actualizarse en consecuencia. GET /players y GET /players/:id incluyen los 7 campos nuevos en la respuesta. Los filtros existentes no cambian. La card de jugador en el frontend debe reflejar al menos goals, assists y yellowCards; el diseño exacto queda a criterio del equipo. No hay lógica de negocio nueva. No se agregan endpoints nuevos. Documentar como decisión de diseño: Yellow y Red se nombran yellowCards y redCards en dominio porque son más semánticos que la abreviatura del fixture."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulta de catálogo y detalle con métricas extendidas (Priority: P1)

Como usuario o consumidor de la API, quiero consultar el catálogo de jugadores y el detalle individual de un jugador y obtener sus estadísticas completas de rendimiento (goles, asistencias, pases clave, regates, entradas totales, tarjetas amarillas y rojas) para disponer de toda la información de desempeño de la temporada.

**Why this priority**: Es el valor observable principal de la feature y el contrato directo que requiere la feature 012 (sistema de cotización) y el frontend.

**Independent Test**: Se puede probar realizando peticiones a `GET /players` y `GET /players/:id` verificando que la respuesta incluya los 7 nuevos campos estadísticos con sus valores correspondientes o `null` cuando no haya datos registrados.

**Acceptance Scenarios**:

1. **Given** un jugador sincronizado con estadísticas registradas en la temporada, **When** se consulta `GET /players` o `GET /players/:id`, **Then** la respuesta incluye `goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards` y `redCards` con sus valores enteros correspondientes.
2. **Given** un jugador que no registra partidos o cuyas estadísticas no fueron informadas para ciertas métricas, **When** se consulta `GET /players` o `GET /players/:id`, **Then** dichos campos retornan con valor `null`.
3. **Given** consultas a `GET /players` con filtros existentes (liga, equipo, posición, paginación), **When** se ejecuta la búsqueda, **Then** los filtros y la paginación funcionan de manera idéntica a la actual, incluyendo las 7 nuevas métricas en cada elemento del listado.

---

### User Story 2 - Ingesta y persistencia de las 7 métricas en la sincronización de WhoScored (Priority: P1)

Como sistema de sincronización de catálogo, necesito capturar los 7 campos adicionales expuestos por WhoScored (`Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow`, `Red`) durante el scraping del perfil y persistirlos en la base de datos asociados al jugador, para alimentar el catálogo y la futura valoración de mercado.

**Why this priority**: Sin la captura y persistencia de estas métricas en el proceso de sincronización, la base de datos carecería de la información necesaria para los endpoints de lectura y el cálculo de cotización.

**Independent Test**: Se puede probar ejecutando la sincronización de WhoScored sobre un fixture/mock que contenga los campos `Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow`, `Red`, verificando que la entidad y el modelo de dominio resultantes persistan y restauren dichos campos con exactitud.

**Acceptance Scenarios**:

1. **Given** datos de estadísticas de temporada de WhoScored con valores para `Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow` y `Red`, **When** el adapter procesa las estadísticas del jugador, **Then** los datos se mapean a `goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards` y `redCards` respectivamente.
2. **Given** un jugador sin apariciones o con estadísticas vacías en el reporte de WhoScored, **When** el adapter procesa al jugador, **Then** las 7 métricas se establecen como `null` sin fallar la sincronización del equipo o liga.
3. **Given** una sincronización sucesiva con actualización en las métricas de un jugador existente, **When** se aplica el sync, **Then** los valores de las 7 métricas se actualizan en la base de datos manteniendo la integridad del registro.

---

### User Story 3 - Visualización de métricas clave en la tarjeta y detalle del jugador en Frontend (Priority: P2)

Como usuario de la aplicación web, quiero ver en la tarjeta de cada jugador del catálogo al menos sus goles, asistencias y tarjetas amarillas, y en la página de detalle todas sus estadísticas, para evaluar rápidamente el desempeño deportivo del futbolista.

**Why this priority**: Permite al usuario final visualizar de forma clara las estadísticas más representativas del jugador directamente desde la interfaz de usuario.

**Independent Test**: Renderizar el componente `PlayerCard` y la página `PlayerDetailPage` con un jugador que contenga valores para las nuevas métricas (y casos con `null`), verificando que se muestren adecuadamente en la interfaz con formato amigable y tratamiento de valores nulos.

**Acceptance Scenarios**:

1. **Given** un jugador con estadísticas disponibles, **When** se visualiza su tarjeta en el catálogo, **Then** se muestran al menos sus goles (`goals`), asistencias (`assists`) y tarjetas amarillas (`yellowCards`).
2. **Given** un jugador con estadísticas disponibles, **When** se navega a su página de detalle (`/catalog/:id`), **Then** se visualizan las métricas extendidas completas (goles, asistencias, pases clave, regates, entradas totales, amarillas y rojas).
3. **Given** un jugador con métricas en `null`, **When** se visualiza su tarjeta o detalle, **Then** la UI muestra un indicador neutro (por ejemplo un guion `—` o `0`) sin romper el diseño ni fallar en la renderización.

---

### Edge Cases

- **Valores ausentes o nulos en WhoScored**: Si WhoScored no provee alguno de los 7 campos en el objeto de estadísticas de torneo, el adapter y el mapper asignan `null` de forma segura.
- **Jugador sin partidos jugados (0 apariciones)**: Todas las métricas de conteo y promedio quedan en `null`.
- **Valores en 0 vs null**: Un valor explícito de 0 en WhoScored (ej. 0 goles) se persiste y expone como `0` numérico, distinguiéndose de `null` (sin datos / sin participación).
- **Compatibilidad con registros previos en base de datos**: Los jugadores previamente persistidos en la base de datos admiten `null` en las nuevas columnas sin requerir valores por defecto forzados ni romper consultas previas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El modelo de dominio `Player` MUST incluir 7 nuevos atributos enteros y nulleables: `goals` (`number | null`), `assists` (`number | null`), `keyPasses` (`number | null`), `dribbles` (`number | null`), `totalTackles` (`number | null`), `yellowCards` (`number | null`) y `redCards` (`number | null`).
- **FR-002**: El puerto e interfaces del adapter de WhoScored (`WhoScoredRawMetrics` y estructuras de payload) MUST extenderse para capturar los campos correspondientes desde la fuente: `Goals` → `goals`, `Assists` → `assists`, `KeyPasses` → `keyPasses`, `Dribbles` → `dribbles`, `TotalTackles` → `totalTackles`, `Yellow` → `yellowCards`, `Red` → `redCards`.
- **FR-003**: El adapter de WhoScored MUST mantener intacta su lógica de navegación, scraping y endpoints de disparo (`sync-trigger`), limitándose únicamente a extraer y mapear estos 7 campos adicionales de las estadísticas de torneo de cada jugador.
- **FR-004**: La entidad de persistencia `PlayerEntity` MUST incorporar las 7 nuevas columnas como tipos enteros nulleables (`integer`, `nullable: true`).
- **FR-005**: El mapeador de persistencia `PlayerMapper` MUST mapear bidireccionalmente las 7 métricas entre `PlayerEntity` y el modelo de dominio `Player`.
- **FR-006**: Se MUST proveer una migración de base de datos que agregue las 7 columnas a la tabla `players` como columnas enteras nulleables (`integer NULL`).
- **FR-007**: Los DTOs de respuesta `PlayerResponseDto` (utilizado por `GET /players` y `GET /players/:id`) MUST incluir las 7 nuevas propiedades con decoradores Swagger `@ApiProperty` describiendo su tipo (`integer`, `nullable: true`) y ejemplos representativos.
- **FR-008**: Los endpoints `GET /players` y `GET /players/:id` MUST retornar las 7 nuevas métricas en su payload JSON sin alterar el comportamiento de los filtros existentes (`league`, `team`, `position`, paginación).
- **FR-009**: La documentación OpenAPI / Swagger generada MUST reflejar los 7 nuevos campos en el esquema de respuesta de jugador.
- **FR-010**: En el frontend, el tipo TypeScript `Player` MUST actualizarse con los 7 campos opcionales/nulleables (`goals?: number | null`, `assists?: number | null`, `keyPasses?: number | null`, `dribbles?: number | null`, `totalTackles?: number | null`, `yellowCards?: number | null`, `redCards?: number | null`).
- **FR-011**: El componente `PlayerCard` en el frontend MUST mostrar de forma clara al menos las estadísticas de `goals`, `assists` y `yellowCards`.
- **FR-012**: La vista `PlayerDetailPage` en el frontend MUST presentar las métricas de rendimiento extendidas para el jugador seleccionado.

### Key Entities

- **Player (Dominio)**: Entidad central del catálogo de jugadores. Atributos: `id`, `name`, `league`, `team`, `position`, `passesCompleted`, `shots`, `interceptions`, `rating`, y las nuevas métricas: `goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards`, `redCards`.
- **PlayerEntity (Persistencia)**: Entidad TypeORM que mapea la tabla `players` con columnas para todas las propiedades del jugador incluyendo las 7 columnas enteras nulleables.
- **PlayerResponseDto (API)**: Objeto de transferencia de datos para las respuestas de catálogo y detalle con la representación pública del jugador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las respuestas de `GET /players` y `GET /players/:id` contienen los 7 nuevos campos estadísticos con sus tipos y valores numéricos o `null`.
- **SC-002**: Una ejecución de sincronización de catálogo con datos de WhoScored persiste las 7 métricas sin generar errores de casteo, pérdida de datos ni truncamiento.
- **SC-003**: La tarjeta de jugador (`PlayerCard`) en el frontend renderiza visualmente al menos `goals`, `assists` y `yellowCards` sin introducir errores visuales ni degradación de rendimiento en la navegación.
- **SC-004**: Los tests unitarios, de integración y de componentes (frontend y backend) pasan en verde con cobertura de los nuevos campos en casos con valores presentes y valores en `null`.
- **SC-005**: La arquitectura respeta estrictamente las reglas de capas (verificado por el test de arquitectura tsarch).

## Assumptions

- **Naturaleza de los datos**: WhoScored reporta `Goals`, `Assists`, `KeyPasses`, `Dribbles`, `TotalTackles`, `Yellow` y `Red` como valores totales acumulados o conteos enteros de la temporada en la competencia sincronizada.
- **Consumo en Feature 012**: La lógica de cotización de jugadores (feature 012) tratará los valores `null` en cualquiera de estas 7 métricas como `0` al computar la fórmula de valuación; esta especificación no realiza dicha conversión en el almacenamiento ni en la API, preservando la distinción entre `null` (desconocido/sin datos) y `0` (cero registrado).
- **Diseño de Frontend**: La distribución estética y estilización exacta de las métricas en `PlayerCard` y `PlayerDetailPage` se adaptan a la guía visual y tema existentes (paleta institucional y badges con Tailwind CSS).

## Design Decisions

### Nomenclatura semántica para tarjetas (`yellowCards` y `redCards`)

En los fixtures y respuestas de WhoScored, las tarjetas disciplinarias figuran con las abreviaturas `Yellow` y `Red`. En el modelo de dominio, entidades de persistencia y DTOs públicos se nombran explícitamente `yellowCards` y `redCards`.

**Justificación**: `Yellow` y `Red` son términos ambiguos (podrían referirse a colores o estados genéricos). `yellowCards` y `redCards` expresan inequívocamente el concepto de negocio en el dominio futbolístico y mantienen consistencia con el resto de los nombres descriptivos del modelo (`passesCompleted`, `totalTackles`, `keyPasses`).

