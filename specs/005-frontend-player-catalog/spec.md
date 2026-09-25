# Feature Specification: Frontend — Catálogo de jugadores

**Feature Branch**: `005-frontend-player-catalog`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Frontend — Catálogo de jugadores. El usuario ve un listado de jugadores con filtros por liga, equipo y posición combinables entre sí, y navega los resultados por página. Liga y posición se eligen de una lista fija de opciones (5 ligas, 4 posiciones); equipo es un campo de texto libre. Si ningún jugador cumple los filtros, el backend responde 200 con una lista vacía, sin mensaje propio para ese caso, la pantalla muestra el texto 'No se encontraron jugadores con estos filtros.', nunca un error. La paginación usa controles de página siguiente/anterior con tamaño de página fijo, mostrando el total de resultados y el rango visible. No hay selector de tamaño de página. Al seleccionar un jugador del listado, el usuario acceso a una vista de detalle con toda su información. Si el jugador ya no existe, el backend responde 404 con un mensaje propio en el body, la vista muestra ese mensaje tal cual, sin reescribirlo, sin redirigir automáticamente. Al loguearse, el usuario cae directamente en el listado del catálogo. El backend de este catálogo exige una ApiKey (no un JWT) para leer los datos, y esto es independiente de tener o no una sesión iniciada: acceder al listado o al detalle no requiere estar logueado, la única condición es tener una ApiKey válida guardada. Si el usuario todavía no generó una (la pantalla para hacerlo ya existe, y esa sí requiere sesión), el catálogo no consulta al backend: muestra un mensaje ('Necesitás generar una ApiKey para ver el catálogo.') con un link directo a esa pantalla, en vez de generarla por su cuenta en segundo plano. Si una consulta al catálogo devuelve no autorizado (la ApiKey guardada dejó de ser válida, por ejemplo porque se generó una nueva desde la pantalla de cuenta), el catálogo trata ese caso igual que 'no tiene ApiKey': descarta la que tenía guardada y muestra el mismo mensaje con el link, sin reintentar solo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listado de jugadores con filtros y paginación (Priority: P1)

Un visitante o usuario autenticado que cuenta con una clave de acceso (ApiKey) válida guardada ingresa a la vista del catálogo para explorar los futbolistas disponibles. Puede aplicar filtros combinados de liga, posición y equipo, navegar entre páginas de resultados con controles de Siguiente/Anterior y visualizar el rango de futbolistas que está observando junto con el total. Si realiza una búsqueda sin coincidencias, ve una indicación clara en pantalla de que no se encontraron jugadores.

**Why this priority**: Es la funcionalidad principal de exploración de jugadores; permite a cualquier usuario consultar la oferta de futbolistas disponibles y filtrar según sus criterios.

**Independent Test**: Se puede probar abriendo la vista del catálogo con una clave guardada, seleccionando opciones de filtro (por ejemplo, liga y posición), cambiando de página con los botones de navegación y verificando que los resultados actualizados coinciden con los criterios aplicados y que el contador de rango/total se actualiza correctamente.

**Acceptance Scenarios**:

1. **Given** un usuario con una ApiKey válida guardada, **When** accede al catálogo, **Then** ve el listado de jugadores, los controles de filtro, la paginación con controles Anterior/Siguiente, y la información del rango visible y total de resultados.
2. **Given** el listado del catálogo, **When** el usuario selecciona una liga de las 5 disponibles, una posición de las 4 disponibles e ingresa el nombre de un equipo en texto libre, **Then** el listado muestra únicamente los jugadores que cumplen simultáneamente todos los criterios aplicados.
3. **Given** filtros aplicados que no coinciden con ningún jugador, **When** el sistema recibe una respuesta vacía exitosa, **Then** la pantalla muestra el mensaje exacto "No se encontraron jugadores con estos filtros." sin indicar error ni fallo de comunicación.
4. **Given** un listado con múltiples páginas de resultados, **When** el usuario presiona el botón de página Siguiente o Anterior, **Then** el listado muestra los jugadores correspondientes a la nueva página y actualiza la indicación del rango visible (por ejemplo, "Mostrando 11 - 20 de 45").
5. **Given** un usuario que inicia sesión exitosamente en la aplicación, **When** se completa la autenticación, **Then** es redirigido a la pantalla home autenticada (ver **Actualización 2026-09-25** en FR-010 — este destino cambió de vuelta a `/home`; el catálogo sigue accesible desde ahí con un click).

---

### User Story 2 - Consulta de detalle de un jugador (Priority: P1)

Un usuario que navega el catálogo selecciona un jugador específico de la lista para consultar su información detallada. Si el jugador seleccionado ya no existe en el sistema, la pantalla le muestra el mensaje de error original sin alterar su contenido ni redirigir al usuario automáticamente a otra parte.

**Why this priority**: Permite profundizar en la información de un jugador seleccionado desde el catálogo y manejar adecuadamente situaciones donde el recurso no está disponible.

**Independent Test**: Se puede probar seleccionando una tarjeta o fila de jugador desde el listado para verificar que se abre su vista detallada con la información completa, y por separado, intentando acceder a la ficha de un jugador inexistente para confirmar que se exhibe el texto de error recibido sin redirecciones forzadas.

**Acceptance Scenarios**:

1. **Given** un jugador visible en el listado del catálogo, **When** el usuario hace clic sobre él, **Then** accede a su vista de detalle donde se exhibe toda la información del futbolista (nombre, liga, equipo y posición).
2. **Given** un intento de acceder al detalle de un jugador que ya no existe, **When** el sistema recibe una respuesta de recurso no encontrado (404) con un mensaje explícito, **Then** la vista muestra textualmente ese mensaje de error en pantalla, sin modificar su redacción y permaneciendo en la vista sin redirigir de forma automática.

---

### User Story 3 - Control de acceso al catálogo basado en ApiKey (Priority: P1)

Un usuario intenta acceder al catálogo sin poseer una clave de acceso (ApiKey) guardada, o con una clave que dejó de ser válida (por ejemplo, porque fue invalidada al generar una nueva en su cuenta). En lugar de intentar consultar a la API o generar la clave de forma transparente en segundo plano, la pantalla bloquea la consulta y le muestra un mensaje informativo con un enlace directo a la sección de gestión de clave en su cuenta.

**Why this priority**: Garantiza que el catálogo respete la condición de autenticación por ApiKey requerida por los datos, educando al usuario sobre el requisito sin fallos silenciosos ni bucles de reintento.

**Independent Test**: Se puede probar borrando la clave guardada e ingresando al catálogo para verificar que no se realiza ninguna petición de datos y se muestra el mensaje de aviso con el enlace a la cuenta; y alternativamente, usando una clave invalidada para verificar que al recibir una respuesta no autorizada (401), se borra la clave caducada y se muestra el mismo aviso.

**Acceptance Scenarios**:

1. **Given** un usuario que no tiene una ApiKey guardada en su navegador (con o sin sesión iniciada), **When** intenta ver el catálogo o el detalle de un jugador, **Then** la aplicación no realiza consultas de datos y muestra el aviso "Necesitás generar una ApiKey para ver el catálogo." con un enlace directo a la pantalla de cuenta.
2. **Given** un usuario con una ApiKey guardada que dejó de ser válida, **When** se realiza una consulta al catálogo y se recibe una respuesta no autorizada (401), **Then** la aplicación descarta la ApiKey almacenada, no reintenta la consulta automáticamente y muestra el mensaje "Necesitás generar una ApiKey para ver el catálogo." junto al enlace a la pantalla de cuenta.
3. **Given** la pantalla con el mensaje de aviso por falta de ApiKey, **When** el usuario hace clic en el enlace, **Then** es dirigido inmediatamente a la pantalla de gestión de cuenta donde puede generar una nueva clave.

---

### Edge Cases

- ¿Qué ocurre si el usuario escribe espacios en blanco en el filtro de equipo? El sistema limpia los espacios iniciales y finales antes de aplicar el filtro.
- ¿Qué sucede si el usuario navega a la página siguiente mientras se está cargando la lista actual? El control de navegación se deshabilita temporalmente durante la carga para evitar peticiones duplicadas.
- ¿Qué ocurre si la red falla por completo durante la consulta? La pantalla muestra una advertencia de problema de conexión indicando que se vuelva a intentar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla del catálogo MUST permitir filtrar jugadores mediante la combinación simultánea de los tres criterios: Liga, Posición y Equipo.
- **FR-002**: La selección de Liga MUST realizarse desde una lista fija de opciones que incluye exactamente 5 ligas (Premier League, Bundesliga, La Liga, Serie A, Ligue 1).
- **FR-003**: La selección de Posición MUST realizarse desde una lista fija de opciones que incluye exactamente 4 posiciones (GK, DF, MF, FW).
- **FR-004**: El filtro de Equipo MUST ser un campo de entrada de texto libre.
- **FR-005**: Ante una consulta de catálogo que no arroja resultados (respuesta exitosa con lista vacía), la interfaz MUST mostrar el texto exacto "No se encontraron jugadores con estos filtros." y no debe interpretarlo como una condición de error.
- **FR-006**: La paginación del catálogo MUST disponer de controles de navegación "Anterior" y "Siguiente" con un tamaño de página fijo, informando en todo momento el total de resultados y el rango de elementos visibles actualmente.
- **FR-007**: La interfaz MUST NOT incluir selectores ni opciones para modificar el tamaño de página.
- **FR-008**: Al seleccionar un jugador del listado, la interfaz MUST mostrar la vista de detalle con la información completa del futbolista (nombre, liga, equipo y posición).
- **FR-009**: Ante una respuesta de recurso no encontrado (404) al consultar el detalle de un jugador, la interfaz MUST presentar textualmente el mensaje de error retornado, sin reescribir su contenido ni realizar redirecciones automáticas.
- **FR-010**: ~~El destino posterior a un inicio de sesión exitoso MUST ser la pantalla del catálogo de jugadores.~~
  **Actualización 2026-09-25**: el destino posterior a un inicio de sesión exitoso vuelve a ser la pantalla home autenticada (`/home`, definida en `003-frontend-auth` FR-022), no el catálogo. Decisión explícita del usuario del proyecto, revirtiendo la redirección directa a `/catalog` que introdujo esta feature. El catálogo sigue siendo de acceso público (FR-011 no cambia) y queda a un click desde home; esto sólo afecta a dónde aterriza el usuario justo después de loguearse.
- **FR-011**: El acceso a la lectura del catálogo (tanto el listado como el detalle) MUST requerir únicamente la presencia de una ApiKey válida guardada, independientemente de si existe o no una sesión de usuario iniciada.
- **FR-012**: Si no existe una ApiKey guardada localmente, la aplicación MUST NOT realizar peticiones de datos de catálogo y MUST presentar el mensaje exacto "Necesitás generar una ApiKey para ver el catálogo." junto con un enlace directo a la pantalla de gestión de cuenta.
- **FR-013**: Ante una respuesta de falta de autorización (401) en cualquier consulta de catálogo, la aplicación MUST descartar inmediatamente la ApiKey guardada, no debe reintentar la solicitud automáticamente y MUST mostrar el mensaje "Necesitás generar una ApiKey para ver el catálogo." con el enlace a la pantalla de cuenta.

### Key Entities *(include if feature involves data)*

- **Jugador**: Entidad del catálogo que representa a un futbolista. Atributos principales: identificador único, nombre completo, liga a la que pertenece, equipo en el que juega y posición en el campo.
- **Filtro de Catálogo**: Estructura de criterios de búsqueda activa que combina selección de Liga (de 5 opciones), selección de Posición (de 4 opciones) y término de búsqueda libre por Equipo.
- **Estado de Paginación**: Información que controla la navegación de resultados, incluyendo número de página actual, total de elementos encontrados y el rango de elementos mostrados en la vista actual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ~~El 100% de los usuarios que inician sesión son redirigidos directamente a la vista del catálogo de jugadores.~~ **Actualización 2026-09-25**: el 100% de los usuarios que inician sesión son redirigidos a la pantalla home autenticada (`/home`), ver FR-010.
- **SC-002**: Los usuarios pueden aplicar cualquier combinación de los 3 filtros (liga, posición, equipo) y obtener los resultados filtrados o la confirmación de sin resultados en menos de 2 segundos.
- **SC-003**: En caso de no contar con una ApiKey o de que esta sea rechazada con 401, el 100% de las veces la pantalla bloquea la consulta y ofrece el enlace directo a la pantalla de cuenta sin bucles de reintento.
- **SC-004**: El 100% de los errores 404 al consultar un detalle de jugador muestran la redacción exacta del mensaje recibido sin redireccionar al usuario fuera de la página.

## Assumptions

- Se asume que la clave de acceso (ApiKey) obtenida en la pantalla de cuenta se persiste en el almacenamiento local del navegador (`localStorage`) para estar disponible en las lecturas del catálogo.
- Se asume que el tamaño de página del catálogo es de 10 elementos por defecto conforme al backend existente.
- Se asume que la pantalla de gestión de cuenta ya existente permite generar la ApiKey cuando el usuario inicia sesión.

