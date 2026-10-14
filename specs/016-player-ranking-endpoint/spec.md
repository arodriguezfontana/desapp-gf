# Feature Specification: Ranking de Jugadores por Cotización Vigente (GET /players/ranking)

**Feature Branch**: `016-player-ranking-endpoint`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "La feature agrega el endpoint GET /players/ranking para consultar el listado de jugadores ordenados descendentemente según su cotización vigente (valor) bajo la estrategia activa. Solo se incluyen jugadores con al menos un quote calculado — los que no tienen cotización quedan excluidos. El quote usado es el más reciente por calculatedAt de cada jugador, independientemente de qué estrategia lo generó: si la estrategia activa cambió pero aún no se recalcularon las cotizaciones, se usa el último quote disponible hasta el próximo recálculo. La respuesta tiene la misma estructura de paginación que GET /players con la adicion de rank (posición en el ranking 1..N), valor, score y strategyName de la cotización vigente. El acceso requiere autenticación previa mediante ApiKey. Decisión de diseño a documentar: Se calcula la posición del ranking sobre el último PlayerQuote de cada jugador correspondiente. Se ordena por valor. Si no hay coincidencias, se retorna 200 OK, si no hay con lista vacía ante filtros sin coincidencias en lugar de un error de cliente, ya que representa un resultado de búsqueda válido."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar ranking general de jugadores ordenados por valor (Priority: P1)

Un usuario o consumidor de la plataforma (por ejemplo, el frontend del catálogo o un sistema externo autorizado) desea visualizar un ranking ordenado de jugadores de fútbol según su cotización vigente de mercado para conocer de inmediato quiénes son los futbolistas más valiosos del sistema.

**Why this priority**: Es la funcionalidad esencial del ranking. Permite listar y ordenar a los futbolistas en función de su valor económico estimado, transformando las cotizaciones aisladas en una tabla clasificatoria de mercado.

**Independent Test**: Puede probarse de forma aislada realizando una solicitud `GET /players/ranking` con una ApiKey válida teniendo jugadores con cotizaciones previamente calculadas, verificando que los resultados se retornan ordenados descendentemente por `valor`, asignando el `rank` correlativo (1..N) a cada elemento de la lista.

**Acceptance Scenarios**:

1. **Given** un conjunto de jugadores con cotizaciones calculadas con diferentes valores, **When** se envía una petición `GET /players/ranking` con ApiKey válida y sin filtros, **Then** el sistema responde con HTTP 200 y una lista paginada de jugadores ordenada de forma estrictamente descendente según su `valor` vigente.
2. **Given** jugadores en el ranking, **When** se examina cada elemento de la respuesta, **Then** cada registro incluye los datos de jugador junto con `rank` (número entero positivo correspondiente a su posición en la tabla), `valor`, `score` y `strategyName` de la cotización correspondiente.
3. **Given** una consulta a la primera página (`page=1&pageSize=10`), **When** se reciben los elementos, **Then** el primer jugador tiene `rank = 1`, el segundo `rank = 2`, y sucesivamente hasta `rank = 10`.
4. **Given** jugadores con exactamente el mismo `valor`, **When** se ordenan, **Then** el sistema utiliza como criterio de desempate determinista el `score` descendente y subsidiariamente el identificador o nombre del jugador, garantizando que el orden no varíe entre ejecuciones sucesivas.

---

### User Story 2 - Paginación y navegación del ranking (Priority: P2)

Un cliente de la API desea navegar por las diferentes páginas del ranking de cotizaciones para explorar jugadores de menor valor o comparar diferentes segmentos del mercado manteniendo la coherencia de la posición `rank`.

**Why this priority**: Permite consultar grandes volúmenes de jugadores de manera eficiente y escalable sin sobrecargar la red ni el cliente.

**Independent Test**: Puede probarse de forma aislada solicitando la página 1 y posteriormente la página 2 con un `pageSize` determinado (ej. `pageSize=5`), verificando que los elementos de la página 2 continúan la secuencia de `rank` esperada (ej. del 6 al 10) y que los metadatos de paginación (`total`, `page`, `pageSize`) son consistentes con `GET /players`.

**Acceptance Scenarios**:

1. **Given** un total de 25 jugadores con cotizaciones, **When** se solicita `GET /players/ranking?page=2&pageSize=10`, **Then** el sistema retorna los jugadores correspondientes a la segunda decena con posiciones `rank` del 11 al 20, con `total = 25`, `page = 2` y `pageSize = 10`.
2. **Given** una solicitud sin especificar `page` ni `pageSize`, **When** se procesa la consulta, **Then** el sistema aplica por defecto `page = 1` y `pageSize = 10`.
3. **Given** una solicitud con un `page` superior al total de páginas existentes (ej. `page = 99`), **When** se procesa, **Then** el sistema responde con HTTP 200, `items` como lista vacía `[]`, y `total` reflejando la cantidad global de jugadores cotizados.

---

### User Story 3 - Filtrado por liga, equipo y posición dentro del ranking (Priority: P2)

Un usuario desea consultar el ranking acotado a una liga específica, a un club determinado o a una posición en cancha (por ejemplo, "Ranking de los mejores delanteros" o "Jugadores más cotizados de La Liga").

**Why this priority**: Es fundamental para la experiencia de usuario y análisis deportivo, permitiendo comparaciones justas entre jugadores que compiten en el mismo puesto o certamen.

**Independent Test**: Puede probarse invocando el endpoint pasando parámetros `league`, `position` o `team`, verificando que todos los jugadores devueltos cumplen estrictamente con los filtros aplicados y que el `rank` refleja la posición dentro del subconjunto filtrado.

**Acceptance Scenarios**:

1. **Given** jugadores cotizados de diversas ligas, **When** se solicita `GET /players/ranking?league=Premier League`, **Then** solo se retornan jugadores de dicha liga ordenados por valor descendente, con `rank` secuencial del subconjunto (1, 2, 3...) y `total` igual a los jugadores cotizados de esa liga.
2. **Given** jugadores cotizados de diversas posiciones, **When** se solicita `GET /players/ranking?position=GK`, **Then** solo se retornan arqueros ordenados por valor descendente.
3. **Given** filtros combinados (ej. `league=La Liga&position=FW`), **When** se procesa la consulta, **Then** los filtros se combinan con lógica AND.
4. **Given** filtros que no coinciden con ningún jugador cotizado en la base de datos, **When** se ejecuta la solicitud, **Then** el sistema responde con HTTP 200 y una lista vacía `items: []` con `total: 0`, en lugar de un error.

---

### User Story 4 - Exclusión de jugadores no cotizados y manejo de cambios de estrategia (Priority: P3)

El sistema debe garantizar la integridad del ranking de modo que ningún jugador sin cotización calculada aparezca en la lista, y que ante cambios de estrategia activa se mantenga la continuidad operativa utilizando la última cotización disponible de cada futbolista.

**Why this priority**: Evita inconsistencias visuales (valores nulos o ceros artificiales) y asegura el principio de degradación continua del sistema cuando la estrategia de valuación se actualiza pero el recálculo masivo aún está pendiente.

**Independent Test**: Puede probarse teniendo jugadores cargados en el catálogo donde solo un subconjunto tiene registros de cotización, comprobando que los jugadores sin cotización nunca figuran en el ranking. Asimismo, cambiando la estrategia activa en la base de datos sin ejecutar recálculo masivo, verificar que el ranking sigue operando con los últimos quotes existentes.

**Acceptance Scenarios**:

1. **Given** 10 jugadores en el catálogo de los cuales solo 6 tienen al menos una cotización en `player_quotes`, **When** se consulta `GET /players/ranking`, **Then** el `total` es 6 y los 4 jugadores restantes quedan completamente excluidos del listado.
2. **Given** un jugador con múltiples cotizaciones a lo largo del tiempo, **When** se calcula el ranking, **Then** el sistema utiliza exclusivamente su cotización con `calculatedAt` más reciente.
3. **Given** que la estrategia activa en el sistema se modifica de la Estrategia A a la Estrategia B pero aún no se ejecutó el recálculo masivo, **When** se consulta `GET /players/ranking`, **Then** el sistema construye el ranking con el último quote disponible de cada jugador (generado previamente por la Estrategia A), reportando su respectivo `strategyName`.
4. **Given** una base de datos donde ningún jugador posee cotizaciones calculadas, **When** se consulta `GET /players/ranking`, **Then** el sistema responde con HTTP 200, `items: []` y `total: 0`.

---

### User Story 5 - Protección de acceso mediante ApiKey (Priority: P3)

El endpoint debe requerir autenticación exclusiva por ApiKey para clientes autorizados, manteniéndose coherente con los demás endpoints del recurso `/players`.

**Why this priority**: Protege la propiedad intelectual de los cálculos de valuación de la plataforma y restringe el acceso solo a clientes registrados.

**Independent Test**: Invocar el endpoint sin cabecera `X-Api-Key`, con claves inválidas o con tokens JWT, comprobando el rechazo con status HTTP 401.

**Acceptance Scenarios**:

1. **Given** una solicitud sin cabecera de autenticación ApiKey, **When** se consulta `GET /players/ranking`, **Then** el sistema responde con HTTP 401 Unauthorized.
2. **Given** una solicitud con una ApiKey inexistente o revocada, **When** se envía la petición, **Then** el sistema responde con HTTP 401 Unauthorized.
3. **Given** una solicitud que envía un JWT de sesión en lugar de una ApiKey, **When** se envía la petición, **Then** el sistema rechaza la solicitud con HTTP 401 Unauthorized.

---

### Edge Cases

- **Empates en valor de cotización**: Si dos o más jugadores tienen el mismo valor de cotización (`valor`), el desempate se resuelve por `score` descendente y, si persiste el empate, por `id` de jugador ascendente de forma determinista para que la paginación no duplique ni omita jugadores entre páginas.
- **Filtro de equipo con texto parcial o insensible a mayúsculas**: Si se filtra por `team`, la búsqueda se comporta de forma idéntica a `GET /players` (búsqueda insensible a mayúsculas / coincidencia parcial si aplica en el catálogo).
- **Parámetros de paginación inválidos**:
  - `page` < 1 o no numérico: responde HTTP 400 Bad Request.
  - `pageSize` < 1, no numérico o superior a 50: responde HTTP 400 Bad Request (coherente con `GET /players`).
- **Valores de filtro enum no válidos**:
  - `league` con un nombre que no pertenece a las 5 ligas soportadas: responde HTTP 400 Bad Request.
  - `position` con un valor ajeno a `GK`, `DF`, `MF`, `FW`: responde HTTP 400 Bad Request.
- **Transición entre páginas durante un recálculo masivo**: La paginación utiliza los datos persistidos en base de datos al momento de ejecución de cada query.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer el endpoint `GET /players/ranking` accesible bajo el prefijo `/players`.
- **FR-002**: El endpoint MUST requerir autenticación mediante `ApiKeyGuard` (exento de JWT mediante decorador `@Public()`, coherente con los principios de autenticación de catálogo según Constitución Principio IV).
- **FR-003**: El endpoint MUST excluir de los resultados a cualquier jugador que no posea al menos una cotización registrada en el sistema.
- **FR-004**: Para cada jugador incluido, el sistema MUST utilizar su cotización más reciente determinada por el timestamp `calculatedAt` más alto, independientemente de la estrategia con la que fue calculada.
- **FR-005**: El ranking MUST ordenarse de forma estrictamente descendente según el `valor` de la cotización vigente de cada jugador. En caso de empate en `valor`, el sistema MUST aplicar desempate por `score` descendente y posteriormente por identificador `id` de jugador ascendente.
- **FR-006**: Cada elemento retornado en la lista de jugadores clasificados MUST incluir:
  - Posición en el ranking `rank`: entero positivo correlativo (1..N) calculado respecto al subconjunto ordenado y paginado (`rank = (page - 1) * pageSize + index + 1`).
  - Atributos completos del jugador (identificador `id`, `name`, `league`, `team`, `position`, métricas de rendimiento y `crestUrl` del club si está disponible).
  - Atributos de la cotización vigente: `valor` (formateado como DECIMAL 10,2), `score` (formateado como DECIMAL 8,6) y `strategyName` (nombre descriptivo de la estrategia de valuación que originó dicho cálculo).
- **FR-007**: La respuesta del endpoint MUST tener la misma estructura de paginación que `GET /players`:
  - `items`: arreglo de jugadores clasificados con sus datos de cotización y rank.
  - `total`: total general de jugadores con cotización que satisfacen los filtros aplicados.
  - `page`: página actual solicitada (por defecto 1).
  - `pageSize`: cantidad de elementos por página (por defecto 10, máximo 50).
- **FR-008**: El endpoint MUST aceptar los mismos parámetros opcionales de filtrado y paginación que `GET /players`:
  - `league`: filtro por liga (validado contra el enum de ligas oficiales).
  - `position`: filtro por posición (validado contra el enum `GK`, `DF`, `MF`, `FW`).
  - `team`: filtro por nombre de equipo.
  - `page`: número de página (entero >= 1, default 1).
  - `pageSize`: tamaño de página (entero entre 1 y 50, default 10).
- **FR-009**: Si ningún jugador cumple con los filtros especificados o si la base de datos no contiene jugadores con cotizaciones, el sistema MUST responder con status HTTP 200 y una lista vacía `items: []` con `total: 0`. MUST NOT retornar errores 404 ni 400 en este escenario.
- **FR-010**: Si los parámetros `page`, `pageSize`, `league` o `position` contienen valores inválidos o fuera de rango, el sistema MUST responder con status HTTP 400 Bad Request a través de los mecanismos de validación DTO.
- **FR-011**: Todas las respuestas de error MUST canalizarse a través del filtro global `AllExceptionsFilter`, garantizando que no se filtren detalles de implementación ni stack traces (Constitución Principio III).
- **FR-012**: El endpoint MUST documentarse en OpenAPI v3 con decoradores de `@nestjs/swagger` indicando los status codes 200, 400 y 401 (Constitución Principio VIII).
- **FR-013**: La colección Postman del proyecto MUST actualizarse incorporando la consulta a `GET /players/ranking` con ejemplos representativos de uso con y sin filtros (Constitución Principio X).

### Key Entities

- **Player**: Futbolista del catálogo. Provee identidad, equipo, liga, posición y estadísticas deportivas.
- **PlayerQuote**: Registro de cotización calculado. Atributos clave consumidos: `valor`, `score`, `calculatedAt`, `strategyName`.
- **PlayerRankingItem**: Representación de dominio/DTO que combina la información del jugador enriquecido con los datos de su cotización vigente y su posición ordinal `rank`.

---

## Design Decisions

- **DD-001: Cálculo de ranking sobre el último PlayerQuote de cada jugador por calculatedAt**:
  Se toma el quote con el timestamp `calculatedAt` más reciente de cada jugador, con independencia de cuál haya sido la estrategia que lo generó. Justificación: si la estrategia activa del sistema cambió recientemente pero aún no se ejecutó el recálculo masivo programado o manual, este criterio evita que el ranking quede vacío o inconsistente, garantizando continuidad de servicio y mostrando la última cotización real observada en el mercado.
- **DD-002: Exclusión estricta de jugadores sin cotizaciones**:
  Solo se incluyen futbolistas con al menos un registro en `player_quotes`. Justificación: un ranking de valuación carece de sentido conceptual para jugadores que aún no han sido procesados por el motor de pricing; incluirlos con valores nulos o 0 distorsionaría las métricas y la experiencia de usuario.
- **DD-003: Posición `rank` relativa a los filtros y continua en la paginación**:
  El valor de `rank` refleja la posición del jugador dentro del ranking resultante de los filtros aplicados (por ejemplo, el mejor arquero tiene rank 1 en el ranking de arqueros) y se calcula en función del offset de la página (`(page - 1) * pageSize + index + 1`). Justificación: permite al consumidor presentar la tabla clasificatoria directamente sin tener que recalcular índices en el cliente.
- **DD-004: Respuesta HTTP 200 OK con lista vacía ante filtros sin coincidencias**:
  Cuando no hay jugadores cotizados que coincidan con la búsqueda, se devuelve HTTP 200 con `items: []` y `total: 0` en lugar de un código de error (como 404). Justificación: una búsqueda sin resultados es un estado de consulta normal y válido, no un recurso inexistente ni una anomalía en la petición.
- **DD-005: Autenticación por ApiKeyGuard**:
  El endpoint se ubica en el controlador `PlayerController` bajo `/players/ranking` protegido por `ApiKeyGuard` y marcado con `@Public()`, asegurando coherencia arquitectónica con `GET /players` y `GET /players/:id/quote`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los usuarios autorizados pueden obtener la lista ordenada de jugadores con cotizaciones en menos de 500 milisegundos en condiciones normales de carga.
- **SC-002**: El 100% de los elementos retornados en el ranking corresponden a jugadores que poseen al menos una cotización calculada en el sistema.
- **SC-003**: El orden de los registros en la respuesta cumple de forma estricta la condición de monotonicidad no creciente (`items[i].valor >= items[i+1].valor`) en todas las páginas.
- **SC-004**: Los valores de `rank` mantienen una correlación perfecta de 1 a N sin saltos ni duplicados a lo largo de las páginas consultadas.
- **SC-005**: El 100% de las consultas sin ApiKey válida son bloqueadas con status 401 antes de acceder a la capa de datos.

---

## Assumptions

- Se reutiliza la infraestructura existente de `ApiKeyGuard` y resolución de claves del módulo de autenticación.
- El esquema de paginación sigue los límites y nombres de atributos definidos en `PlayerListResponseDto` (`items`, `total`, `page`, `pageSize`).
- Las cotizaciones vigentes provienen de la tabla/repositorio existente de `player_quotes`.
- Los escudos de los clubes (`crestUrl`) se enriquecen a través del servicio existente `PlayerEnrichmentService` si están disponibles.

