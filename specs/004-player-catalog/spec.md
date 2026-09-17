# Feature Specification: Catálogo de Jugadores (datos de prueba)

**Feature Branch**: `004-player-catalog`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Funcionalidad de catálogo de jugadores (datos de prueba). El sistema expone un listado de jugadores y el detalle de un jugador puntual, con datos cargados a mano: exactamente 20 jugadores ficticios, uno por cada combinación de las 5 ligas (Premier League, Bundesliga, La Liga, Serie A, Ligue 1) y las 4 posiciones del enum propio (GK, DF, MF, FW), garantizando que todo filtro combinado liga+posición tenga al menos un resultado. Los nombres son ficticios, no se usan nombres de jugadores reales. Cada jugador de prueba tiene nombre, liga, equipo y posición. El listado se puede filtrar por liga, equipo y posición, combinando los filtros con AND, y pagina con page (default 1) y pageSize (default 10, máximo 50), devolviendo el total de resultados junto con la página pedida. Si ningún jugador cumple los filtros, la respuesta es una lista vacía, no un error. Pedir el detalle de un jugador con un id que no existe devuelve 404. Ambos endpoints exigen una ApiKey válida, no aceptan JWT. Sin ApiKey, con una inválida o revocada, la operación se rechaza. La entidad principal es Jugador, con nombre, liga, equipo y posición. Documentá como decisión de diseño por qué esta funcionalidad usa datos de prueba en vez de datos reales. Dejá explícito como riesgo aceptado que el catálogo con datos de prueba no refleja planteles reales ni fichajes recientes, y que no tiene métricas de rendimiento, por lo tanto no sirve todavía de insumo para el Sistema de cotización."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listado paginado y filtrable del catálogo (Priority: P1)

Un cliente integrador (por ejemplo, un sistema externo o un futuro consumidor interno) que ya posee una ApiKey válida consulta el listado de jugadores del catálogo de prueba, opcionalmente filtrando por liga, equipo y/o posición, y navega los resultados por página.

**Why this priority**: Es la funcionalidad central del catálogo; sin el listado no hay forma de descubrir qué jugadores existen ni de integrarse contra el catálogo.

**Independent Test**: Se puede probar de forma aislada invocando el listado con una ApiKey válida, sin filtros, y verificando que devuelve 20 jugadores en total repartidos en páginas de a 10 por defecto; y luego repitiendo la prueba combinando cada una de las 20 combinaciones posibles de liga+posición, verificando que cada una devuelve al menos un resultado.

**Acceptance Scenarios**:

1. **Given** una ApiKey válida y ningún filtro, **When** se solicita el listado sin parámetros, **Then** el sistema responde con la primera página (10 jugadores), el total de 20 y los datos de paginación (page=1, pageSize=10).
2. **Given** una ApiKey válida, **When** se filtra por una liga y una posición cuya combinación existe en el catálogo, **Then** el sistema responde con al menos un jugador que cumple simultáneamente ambos criterios (liga Y posición).
3. **Given** una ApiKey válida, **When** se combinan filtros de liga, equipo y posición que en conjunto no cumple ningún jugador, **Then** el sistema responde 200 con una lista vacía y total en 0, no un error.
4. **Given** una ApiKey válida, **When** se solicita `page=2&pageSize=5`, **Then** el sistema responde con los jugadores 6 a 10 del conjunto filtrado y el total refleja el conjunto completo, no el tamaño de la página.
5. **Given** una ApiKey válida, **When** no se especifican `page` ni `pageSize`, **Then** el sistema aplica `page=1` y `pageSize=10` por defecto.
6. **Given** una ApiKey válida, **When** se solicita `pageSize=50`, **Then** el sistema acepta la solicitud y responde con hasta 50 jugadores en esa página.

---

### User Story 2 - Detalle de un jugador puntual (Priority: P1)

Un cliente integrador con una ApiKey válida solicita el detalle completo de un jugador específico del catálogo a partir de su identificador.

**Why this priority**: Es la segunda operación central explícitamente pedida; sin ella el listado no puede complementarse con la información completa de un jugador puntual.

**Independent Test**: Se puede probar de forma aislada tomando el id de un jugador devuelto por el listado, pidiendo su detalle con una ApiKey válida y verificando que los datos (nombre, liga, equipo, posición) coinciden con los del listado; y por separado, pidiendo un id inexistente y verificando la respuesta 404.

**Acceptance Scenarios**:

1. **Given** una ApiKey válida y el id de un jugador existente, **When** se solicita su detalle, **Then** el sistema responde 200 con nombre, liga, equipo y posición de ese jugador.
2. **Given** una ApiKey válida y un id que no corresponde a ningún jugador del catálogo, **When** se solicita su detalle, **Then** el sistema responde 404 sin exponer detalles internos del error.

---

### User Story 3 - Protección de ambos endpoints mediante ApiKey (Priority: P2)

Cualquier solicitud al listado o al detalle de jugadores que no incluya una ApiKey válida es rechazada, sin importar si se presenta un JWT en su lugar.

**Why this priority**: Es un requisito de seguridad explícito; sin esta protección el catálogo quedaría expuesto a cualquier cliente no autorizado.

**Independent Test**: Se puede probar de forma aislada invocando cada endpoint (a) sin ningún header de autenticación, (b) con una ApiKey inexistente o adulterada, (c) con una ApiKey que fue reemplazada por una más nueva (por ende inválida), y (d) con un JWT válido en lugar de una ApiKey, verificando que en los cuatro casos la operación se rechaza y no se filtra ningún dato del catálogo.

**Acceptance Scenarios**:

1. **Given** una solicitud al listado o al detalle sin header de ApiKey, **When** se procesa, **Then** el sistema responde 401 sin devolver datos del catálogo.
2. **Given** una solicitud con una ApiKey que no existe o fue adulterada, **When** se procesa, **Then** el sistema responde 401.
3. **Given** una solicitud con una ApiKey que en algún momento fue válida pero fue reemplazada por una emisión posterior (según la feature `002-api-key-issuance`), **When** se procesa, **Then** el sistema responde 401.
4. **Given** una solicitud que presenta un JWT válido en el header esperado para la ApiKey, **When** se procesa, **Then** el sistema la trata como no autenticada y responde 401.

---

### Edge Cases

- **`pageSize` mayor a 50**: la solicitud se rechaza con 400 (excede el máximo permitido), en línea con la validación de forma a nivel DTO exigida por la constitución.
- **`page` o `pageSize` no numéricos, cero o negativos**: la solicitud se rechaza con 400.
- **`page` más allá de la última página posible** (ej. `page=99` cuando el conjunto filtrado tiene menos páginas): el sistema responde 200 con una lista vacía en `items` y el `total` correcto del conjunto filtrado, no un error.
- **Valor de `liga` o `posición` que no pertenece al enum correspondiente**: la solicitud se rechaza con 400.
- **Filtro de `equipo` que no coincide con ningún equipo del catálogo**: el sistema responde 200 con lista vacía y total 0.
- **Id de jugador con formato inválido** (no correspondiente al tipo de identificador usado): el sistema responde 404, igual que un id bien formado pero inexistente, para no filtrar detalles de implementación sobre el formato interno de los ids.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer una operación de listado de jugadores del catálogo de prueba.
- **FR-002**: El sistema MUST exponer una operación de detalle de un jugador puntual del catálogo de prueba a partir de su identificador.
- **FR-003**: El catálogo MUST contener exactamente 20 jugadores ficticios cargados de antemano, uno por cada combinación posible de las 5 ligas (Premier League, Bundesliga, La Liga, Serie A, Ligue 1) y las 4 posiciones (GK, DF, MF, FW), de modo que toda combinación de filtro liga+posición tenga al menos un resultado.
- **FR-004**: Los nombres, equipos y demás datos de los jugadores del catálogo MUST ser ficticios; el sistema MUST NOT usar nombres ni datos de jugadores reales.
- **FR-005**: Cada jugador del catálogo MUST tener nombre, liga, equipo y posición.
- **FR-006**: El listado MUST permitir filtrar por liga, por equipo y por posición, de forma independiente o combinada, aplicando los filtros presentes con lógica AND.
- **FR-007**: El listado MUST paginar los resultados mediante los parámetros `page` (default 1) y `pageSize` (default 10, máximo 50).
- **FR-008**: La respuesta del listado MUST incluir el total de resultados que cumplen los filtros aplicados (independiente del tamaño de la página) junto con los jugadores de la página solicitada.
- **FR-009**: Si ningún jugador cumple los filtros aplicados, el listado MUST responder con una lista vacía y total en 0, MUST NOT responder con un error.
- **FR-010**: Si se solicita el detalle de un jugador con un id que no existe en el catálogo, el sistema MUST responder 404.
- **FR-011**: Tanto el listado como el detalle MUST exigir una ApiKey válida presentada en la solicitud; ninguno de los dos MUST aceptar un JWT como mecanismo de autenticación alternativo.
- **FR-012**: Si la solicitud no incluye ApiKey, incluye una ApiKey que no existe o está corrompida, o incluye una ApiKey que fue invalidada por reemplazo (revocada), el sistema MUST rechazar la operación con 401 y MUST NOT devolver ningún dato del catálogo.
- **FR-013**: El sistema MUST validar que `page` y `pageSize` sean valores numéricos positivos y que `pageSize` no exceda 50, rechazando con 400 las solicitudes que incumplan esta validación.
- **FR-014**: El sistema MUST validar que los valores de filtro de liga y posición pertenezcan a los enums definidos (5 ligas, 4 posiciones), rechazando con 400 los valores que no pertenezcan a ellos.
- **FR-015**: El catálogo de prueba MUST ser de solo lectura a través de estos endpoints: esta funcionalidad MUST NOT exponer operaciones de alta, baja o modificación de jugadores.

### Key Entities *(include if feature involves data)*

- **Jugador**: Entidad principal del catálogo. Atributos conceptuales:
  - **Identificador**: Referencia unívoca del jugador, usada para pedir su detalle.
  - **Nombre**: Nombre ficticio del jugador, no correspondiente a ninguna persona real.
  - **Liga**: Una de las 5 ligas soportadas (Premier League, Bundesliga, La Liga, Serie A, Ligue 1).
  - **Equipo**: Nombre ficticio del equipo del jugador dentro de su liga.
  - **Posición**: Una de las 4 posiciones del enum propio del dominio (GK, DF, MF, FW).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las 20 combinaciones posibles de filtro liga+posición devuelven al menos un resultado, verificado en el 100% de las combinaciones.
- **SC-002**: Un cliente integrador puede recuperar el catálogo completo (20 jugadores) en, como máximo, 2 páginas usando el `pageSize` máximo permitido.
- **SC-003**: El 100% de las solicitudes al listado o al detalle sin ApiKey, con una ApiKey inválida, o con una ApiKey revocada por reemplazo, son rechazadas sin exponer ningún dato del catálogo.
- **SC-004**: El 100% de las consultas de detalle con un id inexistente responden 404.
- **SC-005**: El listado y el detalle responden en menos de 1 segundo en condiciones normales, dado que el catálogo es un conjunto fijo y pequeño de 20 registros.
- **SC-006**: El 100% de las respuestas de listado con filtros que no matchean ningún jugador devuelven una lista vacía con status de éxito, no un error.

## Design Decisions

### Uso de datos de prueba cargados a mano en lugar de datos reales

Esta primera versión del catálogo usa 20 jugadores ficticios cargados a mano en vez de
datos reales de planteles y fichajes. Traer datos reales implicaría integrarse con un
proveedor externo de datos deportivos (según la Constitución, vía un Adapter dedicado,
p. ej. WhoScored o Football-Data.org), lo cual es un esfuerzo de integración
independiente del contrato de listado/detalle/filtrado/paginación que esta feature busca
validar primero. Fijar un conjunto de datos ficticio, pequeño y determinístico permite
probar exhaustivamente la lógica de filtros combinados y paginación (incluyendo que las
20 combinaciones de liga+posición tengan resultado) sin depender de la disponibilidad,
el formato ni la licencia de datos de un tercero, y evita cualquier cuestión de uso de
nombres de jugadores reales sin autorización.

**Riesgo aceptado**: el catálogo con datos de prueba no refleja planteles reales ni
fichajes recientes, y no incluye métricas de rendimiento de los jugadores. Por lo tanto,
en su estado actual, este catálogo **no sirve todavía como insumo para el Sistema de
cotización** (que necesita datos reales y métricas de rendimiento para calcular una
valuación creíble). Reemplazar los datos de prueba por datos reales con métricas de
rendimiento es un trabajo futuro explícitamente fuera del alcance de esta feature.

### ApiKey como único mecanismo de autenticación, sin aceptar JWT

Estos endpoints se protegen exclusivamente con ApiKey (la credencial emitida por la
feature `002-api-key-issuance`), no con JWT. Esto es consistente con el Principio IV de
la constitución: el requisito de JWT aplica a operaciones que necesitan saber **qué
usuario** está operando; el listado y el detalle del catálogo son operaciones de lectura
de un recurso de referencia que no dependen de la identidad del usuario que consulta,
sino de que quien consulta sea un cliente autorizado del sistema (típicamente un
integrador programático). Usar ApiKey también deja el catálogo listo para ser consumido
en el futuro por sistemas externos o por el propio Sistema de cotización sin exigirles
mantener una sesión de usuario.

## Assumptions

- El mecanismo de validación de ApiKey (header `x-api-key` o equivalente, verificación
  contra el hash almacenado) ya existe según la feature `002-api-key-issuance`; esta
  spec sólo agrega el uso de ese mecanismo como guard sobre los endpoints del catálogo,
  no redefine su emisión ni invalidación.
- "ApiKey revocada" se interpreta, según el modelo ya definido en `002-api-key-issuance`,
  como una ApiKey que fue invalidada por el reemplazo de una emisión posterior; esta
  feature no agrega un mecanismo de revocación manual independiente.
- El id de jugador es un identificador técnico interno (por ejemplo, numérico o UUID)
  sin significado de negocio; el formato concreto es un detalle de implementación no
  relevante para esta spec.
- El filtro por `equipo` hace match exacto (no búsqueda parcial) contra el nombre de
  equipo cargado en el catálogo de prueba, de forma insensible a mayúsculas/minúsculas.
- El orden de los resultados del listado es estable entre solicitudes (por ejemplo, por
  id ascendente) aunque no se haya pedido explícitamente un criterio de orden.
- Los 20 jugadores y sus equipos ficticios se cargan como datos de semilla fijos del
  catálogo (no administrables vía API); no existe en esta feature una operación para
  agregar, editar o eliminar jugadores del catálogo.
- El nombre de equipo asignado a cada jugador es arbitrario dentro de su liga y no
  necesita guardar ninguna relación con clubes reales, más allá de no reutilizar nombres
  de clubes reales existentes.
