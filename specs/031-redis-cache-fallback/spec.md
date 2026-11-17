# Feature Specification: Caché Redis para endpoints de alta frecuencia y degradación controlada ante fallas externas

**Feature Branch**: `031-redis-cache-fallback`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Caché Redis para endpoints de alta frecuencia y degradación controlada ante fallas externas — La plataforma implementa una capa de aceleración y resiliencia basada en Redis para absorber las consultas de lectura de mayor concurrencia y volumen del sistema: el catálogo de jugadores (GET /players), el detalle individual de un futbolista (GET /players/:id) y el ranking de cotizaciones personalizadas del usuario autenticado (GET /players/ranking). Las consultas de alta frecuencia no van directamente a la base de datos relacional ni a servicios externos en cada solicitud; se resuelven contra una caché en memoria distribuida aplicando el patrón Cache-Aside. Si la respuesta está almacenada en caché (cache hit), se entrega inmediatamente con una latencia inferior a 10 ms (superando ampliamente los objetivos de SLA de 300 ms para lecturas simples y 800 ms para lecturas calculadas); si no está (cache miss), la consulta se ejecuta en PostgreSQL, se almacena en Redis con un tiempo de vida (TTL) determinado y se retorna al cliente. El ranking de jugadores (GET /players/ranking) refleja el valor de cada futbolista según la estrategia de cotización seleccionada por el usuario autenticado. Como la parte de negocio y cálculo del ranking ya existe y cada usuario tiene sus propias cotizaciones, la optimización no altera las reglas de ordenamiento (valor desc, score desc, id asc) ni el filtrado por liga, equipo o posición, sino su velocidad de acceso: los resultados paginados del ranking para cada combinación de usuario, filtros y paginación se resguardan en Redis bajo claves con el identificador del usuario (userId) y un hash determinista de los parámetros solicitados. La vigencia de estas entradas depende del ciclo de recálculo: un ranking guardado en caché se invalida inmediatamente cuando el usuario recalcula sus cotizaciones (POST /quotes/recalculate o cron semanal) o cuando cambia su estrategia activa (PATCH /users/me/strategies/:id/select o actualización de ponderaciones), evitando que el usuario visualice valores desactualizados. Para el catálogo general (GET /players) y el detalle de jugador (GET /players/:id), las respuestas se cachean incluyendo el enriquecimiento de escudos obtenido de la tabla de equipos. Las claves se identifican por el identificador del jugador o por el hash de los filtros aplicados (liga, equipo, posición, página y tamaño). Estas entradas tienen un TTL de seguridad prolongado (1 hora), pero se invalidan de forma explícita y proactiva cada vez que finaliza un proceso de sincronización externa exitoso (POST /sync/whoscored o POST /sync/football-data), momento en el cual el catálogo sufre modificaciones en métricas o planteles. El sistema implementa una política de fallback explícito de dos niveles para datos dependientes de APIs externas (Football-Data.org y WhoScored). Cuando un servicio o adapter necesita datos de un proveedor externo (por ejemplo, escudos de clubes, tablas de posiciones o métricas de rendimiento), la respuesta obtenida se almacena en la caché de Redis. Si el proveedor externo se encuentra fuera de servicio, responde con errores 5xx, agota el tiempo de espera (timeout) o rechaza la solicitud por límite de tasa de consultas (HTTP 429 Rate Limit Exceeded), el sistema intercepta la excepción, emite una advertencia en los logs técnicos sin propagar un 500 al cliente, y activa el fallback explícito: sirve los datos previamente resguardados en Redis; si no estuvieran en caché, utiliza los datos ya persistidos en las tablas locales de PostgreSQL (teams, matches, standings, players). Si un dato puntual no existe ni en caché ni en base de datos (por ejemplo, un escudo nuevo no provisto), se degrada de forma segura a null de acuerdo con la constitución del proyecto, garantizando que ninguna falla externa interrumpa la navegación ni el funcionamiento del sistema. Asimismo, la disponibilidad del backend no queda atada a la supervivencia de Redis (fail-open / degradación controlada): si el servidor de Redis sufre una caída de red, rechaza conexiones o agota su tiempo de respuesta, el cliente de caché captura el error, emite un log de advertencia y redirige automáticamente todas las operaciones de consulta y escritura directamente a la base de datos PostgreSQL. De este modo, la indisponibilidad de la caché impacta temporalmente en la latencia, pero nunca provoca respuestas 500 ni interrupción del servicio para los usuarios. Para que las consultas a la base de datos que respaldan a los cache misses no degraden el motor relacional, se incorporan índices B-Tree específicos calculados a partir de los patrones de acceso reales medidos. En la tabla players, se crea un índice compuesto sobre el estado de baja lógica y los criterios de filtrado más frecuentes (removed_at, league, position) para evitar escaneos secuenciales (Seq Scan) en findPage y findRanking. En la tabla player_quotes, se optimiza el acceso al último quote vigente mediante un índice compuesto descendente (user_id, player_id, calculated_at DESC), y se simplifica la consulta interna de findRanking para que la partición por jugador utilice el índice sin ordenar todo el historial en memoria de trabajo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aceleración de consultas de catálogo de alta frecuencia (Priority: P1)

Un usuario o aplicación cliente consulta repetidamente el catálogo de jugadores (`GET /players`) o el detalle de un futbolista (`GET /players/:id`) y recibe respuestas inmediatas con latencia mínima, servidas directamente desde la memoria caché tras la primera petición, aliviando la carga sobre el motor de base de datos relacional.

**Why this priority**: Es el núcleo de la aceleración de lecturas de alta frecuencia exigida por la constitución (Principio XIII). El catálogo es el punto de entrada principal de los usuarios y su velocidad condiciona toda la experiencia de uso.

**Independent Test**: Consultar un listado de jugadores con filtros específicos; la primera petición consulta la base de datos y almacena el resultado en caché. Las peticiones subsiguientes idénticas responden en una fracción del tiempo original (< 15 ms), devolviendo exactamente la misma carga útil y estructura paginada.

**Acceptance Scenarios**:

1. **Given** un catálogo de jugadores y una consulta `GET /players?league=Premier League&page=1&pageSize=10` no almacenada previamente, **When** se ejecuta la solicitud, **Then** el sistema obtiene los datos de la base de datos relacional, almacena la respuesta enriquecida en la caché con su TTL correspondiente y responde con HTTP 200.
2. **Given** una consulta de catálogo ya presente en la caché, **When** un cliente envía una solicitud con los mismos filtros y paginación, **Then** el sistema responde con HTTP 200 entregando los datos directamente desde la memoria en menos de 15 ms, sin ejecutar consultas en la base de datos.
3. **Given** dos consultas con los mismos filtros pero en diferente orden en la query string (por ejemplo `?league=La Liga&position=FW` y `?position=FW&league=La Liga`), **When** se resuelven, **Then** el sistema reconoce ambas bajo la misma clave canónica de caché, reutilizando el resultado cacheado.
4. **Given** una consulta por un jugador puntual `GET /players/:id`, **When** se invoca por segunda vez, **Then** se sirve desde la caché manteniendo todos los campos de información deportiva y el enlace de escudo asociado.

---

### User Story 2 - Aceleración e invalidación oportuna del ranking de jugadores por usuario (Priority: P1)

Un usuario autenticado navega por su ranking de cotizaciones (`GET /players/ranking`) de forma ágil y fluida. Al recalcular sus cotizaciones o cambiar su estrategia activa, la caché de su ranking se invalida de inmediato para que la próxima lectura exhiba sus cotizaciones actualizadas sin discrepancias.

**Why this priority**: El ranking personal involucra cálculos complejos y agregaciones sobre cotizaciones históricas. Acelerarlo mediante caché es esencial para la escalabilidad, y la invalidación proactiva garantiza que ningún usuario tome decisiones sobre precios obsoletos.

**Independent Test**: Consultar el ranking de un usuario; verificar que la segunda consulta se resuelve desde la caché. Disparar un recálculo de cotizaciones para ese usuario o cambiar su estrategia seleccionada; verificar que la siguiente consulta al ranking regenera los datos con los valores nuevos y renueva la entrada en caché.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con cotizaciones calculadas, **When** consulta `GET /players/ranking`, **Then** la primera solicitud genera la respuesta desde la base de datos y la almacena en caché aislada bajo su identificador de usuario (`userId`).
2. **Given** un usuario autenticado consultando su ranking por segunda vez, **When** se solicita la misma página y filtros, **Then** responde desde la caché sin consultar la base de datos.
3. **Given** dos usuarios distintos con estrategias de valuación diferentes, **When** ambos consultan la misma página del ranking (`page=1&pageSize=10`), **Then** cada uno recibe su propio ranking correspondiente a su propia estrategia, sin colisiones ni filtración de datos entre usuarios.
4. **Given** un ranking cacheado para un usuario, **When** se ejecuta un recálculo de cotizaciones (`POST /quotes/recalculate` o cron semanal) o el usuario cambia su estrategia activa (`PATCH /users/me/strategies/:id/select`), **Then** todas las entradas de caché del ranking asociadas a ese usuario se eliminan inmediatamente, y la siguiente consulta calcula y cachea los nuevos valores.

---

### User Story 3 - Degradación controlada y fallback explícito ante fallas externas (Priority: P1)

Un usuario o proceso interactúa con funcionalidades dependientes de proveedores externos (Football-Data.org o WhoScored, como escudos de clubes o datos sincronizados). Si el proveedor externo falla, se corta la conexión o excede su límite de peticiones (429), el sistema activa un fallback explícito utilizando los datos resguardados en caché o en la base de datos local, respondiendo con éxito y sin propagar un error 500 al usuario.

**Why this priority**: Cumple con el Principio I (Arquitectura en capas y degradación ante fallo de proveedor externo) y el Principio XIII de la constitución. Garantiza la continuidad operativa del sistema ante contingencias de terceros que escapan al control de la plataforma.

**Independent Test**: Simular un fallo de red o error 5xx en el proveedor externo Football-Data.org al consultar un recurso o sincronizar; verificar que el sistema recurre a la información disponible en caché o en la tabla local de equipos, manteniendo la respuesta HTTP 200 y registrando una advertencia en los logs técnicos.

**Acceptance Scenarios**:

1. **Given** datos de un proveedor externo almacenados en caché o en base de datos local, **When** una consulta intenta actualizar o consultar al proveedor externo y éste responde con error 5xx o timeout, **Then** el sistema captura la falla, emite un log de advertencia y devuelve los datos disponibles en el almacenamiento local con HTTP 200.
2. **Given** un proveedor externo que responde con HTTP 429 (*Too Many Requests*), **When** se procesa la solicitud, **Then** el sistema recurre al fallback de datos cacheados o persistidos sin lanzar una excepción no controlada hacia el cliente.
3. **Given** un recurso nuevo que no existe en el proveedor externo ni en la caché ni en la base local (por ejemplo, el escudo de un equipo recién ingresado sin coincidencia), **When** se resuelve el enriquecimiento, **Then** el sistema asigna `null` de forma segura de acuerdo a la constitución, sin interrumpir la respuesta de la lista ni del detalle del jugador.
4. **Given** un proceso de sincronización externa con fallos parciales de un proveedor, **When** se ejecuta la corrida, **Then** los datos previamente sincronizados y cacheados permanecen intactos y disponibles para las consultas de los usuarios.

---

### User Story 4 - Resiliencia de la aplicación ante caídas de la caché (fail-open) (Priority: P2)

Quien opera la plataforma necesita que un eventual corte o indisponibilidad del servicio de caché (Redis fuera de servicio, saturación de memoria o timeout de conexión) no derribe la API ni produzca respuestas 500 hacia los clientes.

**Why this priority**: Evita que una herramienta de optimización de performance se convierta en un punto único de falla (*Single Point of Failure*). La aplicación debe priorizar la disponibilidad y la corrección de los datos.

**Independent Test**: Detener el contenedor de Redis durante la ejecución de pruebas; verificar que las peticiones a `GET /players`, `GET /players/:id` y `GET /players/ranking` continúan respondiendo con HTTP 200 consultando directamente PostgreSQL, registrando advertencias controladas en los logs.

**Acceptance Scenarios**:

1. **Given** el servicio de Redis detenido o inalcanzable, **When** un cliente consulta `GET /players`, **Then** el sistema detecta la falla de conexión, emite un log `warn` con el detalle técnico y atiende la solicitud exitosamente desde PostgreSQL (HTTP 200).
2. **Given** el servicio de Redis inalcanzable, **When** se dispara un evento de invalidación por recálculo de cotizaciones, **Then** el error de invalidación se captura y loguea limpiamente sin hacer fallar el proceso de recálculo ni la transacción principal.
3. **Given** el servicio de Redis restablecido tras una caída, **When** ingresan nuevas peticiones, **Then** el cliente de caché reanuda el almacenamiento y recuperación en memoria de forma transparente y automática.

---

### User Story 5 - Optimización de acceso a datos mediante índices medidos (Priority: P2)

El administrador de la base de datos y el motor de consultas necesitan que, ante un *cache miss* o consultas concurrentes, PostgreSQL resuelva los filtros de catálogo y la partición del ranking sin recurrir a escaneos secuenciales (*Seq Scan*) ni ordenamientos costosos en memoria de trabajo.

**Why this priority**: El Principio XIII exige que los índices se incorporen según patrones de acceso reales medidos. Sin estos índices, un *cache miss* masivo o una ráfaga de peticiones degradaría severamente la base de datos relacional.

**Independent Test**: Ejecutar consultas de catálogo con filtros combinados y de ranking mediante `EXPLAIN ANALYZE`; verificar que el optimizador de PostgreSQL utiliza *Index Scan* o *Bitmap Index Scan* sobre los nuevos índices creados, reduciendo drásticamente los buffers de lectura y el costo de ejecución.

**Acceptance Scenarios**:

1. **Given** una tabla `players` con cientos de registros, **When** se consulta `findPage` con filtros de liga y posición sobre jugadores activos (`removedAt IS NULL`), **Then** la base de datos utiliza el índice compuesto `(removedAt, league, position)` evitando escanear la tabla completa.
2. **Given** una tabla `player_quotes` con múltiples cotizaciones acumuladas por usuario y jugador, **When** se ejecuta la consulta de ranking para obtener la cotización más reciente de cada jugador, **Then** la consulta aprovecha el índice compuesto descendente `(user_id, player_id, calculated_at DESC)`.
3. **Given** el recálculo masivo de cotizaciones insertando nuevas filas, **When** se actualizan los índices, **Then** la penalización de escritura se mantiene acotada a los dos índices indispensables justificados por la medición.

---

### Edge Cases

- **Parámetros con espacios o mayúsculas distintas en queries**: Las claves de caché normalizan los filtros (p. ej. recortando espacios en blanco en `team` y transformando identificadores de posición a mayúsculas) para maximizar la tasa de aciertos de caché (*cache hit ratio*).
- **Recálculo de cotizaciones en curso**: Si un usuario consulta su ranking mientras un recálculo global está en ejecución, continúa viendo el ranking cacheado vigente hasta que el recálculo guarde las nuevas filas y emita el evento de invalidación.
- **Paginación fuera de rango**: Consultas a páginas sin resultados (p. ej. `page=999`) también se cachean brevemente o con el TTL estándar para proteger la base de datos de barridos maliciosos o erróneos.
- **Fallas simultáneas de Redis y del proveedor externo**: Si fallan tanto la caché como la API externa de manera simultánea, el sistema recurre de inmediato a los datos locales persistidos en PostgreSQL, garantizando siempre la respuesta más completa posible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST implementar una capa de almacenamiento en caché en memoria basada en Redis para interceptar las consultas a `GET /players`, `GET /players/:id` y `GET /players/ranking`.
- **FR-002**: Las consultas que encuentren una entrada válida en caché (*cache hit*) MUST responder directamente desde la memoria sin emitir consultas a la base de datos relacional PostgreSQL.
- **FR-003**: Ante un *cache miss*, el sistema MUST consultar PostgreSQL, persistir el resultado en la caché con su correspondiente tiempo de expiración (TTL) y devolver la respuesta al cliente.
- **FR-004**: La generación de claves de caché MUST ser determinista: dos solicitudes con los mismos parámetros en distinto orden MUST mapear exactamente a la misma clave de Redis.
- **FR-005**: Para el ranking de jugadores (`GET /players/ranking`), la clave de caché MUST incluir obligatoriamente el identificador del usuario autenticado (`userId`), garantizando un aislamiento estricto de datos entre usuarios.
- **FR-006**: El sistema MUST invalidar proactivamente todas las entradas de caché de ranking de un usuario cuando se ejecute un recálculo de sus cotizaciones o cuando el usuario modifique su estrategia activa de valuación (selección o ponderaciones).
- **FR-007**: El sistema MUST invalidar proactivamente las entradas de caché del catálogo general y detalle de jugadores cuando finalice una sincronización de datos con proveedores externos.
- **FR-008**: El sistema MUST resguardar en caché las respuestas obtenidas de proveedores externos (escudos, partidos y clasificaciones de Football-Data.org) para independizar las lecturas frecuentes del proveedor de origen.
- **FR-009**: Ante un fallo del proveedor externo (error de red, tiempo de espera agotado, HTTP 5xx o HTTP 429 por límite de cuota), el sistema MUST activar un fallback explícito que sirva los datos disponibles en caché o en la base de datos local en PostgreSQL sin devolver un error 500 al cliente.
- **FR-010**: Si un dato externo no se encuentra en el proveedor, ni en la caché, ni en la base local, el sistema MUST degradar el campo a `null` de forma segura, permitiendo que la respuesta continúe con éxito.
- **FR-011**: Si el servicio de Redis no se encuentra disponible (desconexión, timeout o fallo de arranque), el sistema MUST operar en modo *fail-open*, omitiendo el acceso a caché y atendiendo las peticiones directamente desde PostgreSQL con HTTP 200, registrando la contingencia en los logs con nivel `warn`.
- **FR-012**: El sistema MUST definir un TTL por defecto de 3600 segundos (1 hora) para el catálogo y detalle de jugadores, y de 86400 segundos (24 horas) para el ranking de usuario, sujeto a invalidación temprana.
- **FR-013**: El esquema de base de datos relacional MUST incluir un índice compuesto sobre `players ("removedAt", "league", "position")` para optimizar las consultas de catálogo y ranking sobre futbolistas activos.
- **FR-014**: El esquema de base de datos relacional MUST incluir un índice compuesto sobre `player_quotes ("user_id", "player_id", "calculated_at" DESC)` para permitir que la selección de la cotización más reciente de cada jugador para un usuario se resuelva mediante Index Scan.
- **FR-015**: La consulta en repositorio para resolver el ranking (`PlayerRepository.findRanking`) MUST estar optimizada para utilizar el índice descendente y no ejecutar ordenamientos redundantes de filas históricas en memoria.
- **FR-016**: La configuración de conexión a Redis (host, puerto, credenciales) y los valores de TTL MUST gestionarse mediante variables de entorno con valores por defecto seguros para desarrollo local.

### Key Entities *(include if feature involves data)*

- **Entrada de Caché de Catálogo**: Representa una página o subconjunto de jugadores resultante de filtros de liga, posición y equipo, serializada en formato JSON, asociada a un TTL y a una clave con hash determinista de parámetros.
- **Entrada de Caché de Ranking**: Representa la vista paginada de jugadores cotizados para un usuario puntual bajo su estrategia vigente, serializada en formato JSON y clasificada bajo el namespace del usuario.
- **Registro de Caché de Proveedor Externo**: Copia en memoria de las respuestas y metadatos obtenidos de APIs externas (p. ej. coincidencia de nombres de equipos y escudos de Football-Data.org), utilizada como primer nivel de fallback.
- **Índice Compuesto de Acceso**: Estructuras B-Tree persistidas en PostgreSQL que aceleran los caminos de búsqueda real tanto para jugadores activos como para cotizaciones vigentes por usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las peticiones de lectura a `GET /players`, `GET /players/:id` y `GET /players/ranking` con acierto en caché (*cache hit*) presentan una latencia p95 ≤ 15 ms en entorno de pruebas con 30 usuarios virtuales concurrentes.
- **SC-002**: La tasa de error 5xx ante cortes simulados o caídas del proveedor externo de datos (Football-Data.org) se mantiene estrictamente en 0 % para las consultas de catálogo y ranking.
- **SC-003**: Disponibilidad del 100 % (sin respuestas 500) en todos los endpoints de lectura ante la caída o detención completa del servicio de Redis, manteniendo el servicio operativo a través de PostgreSQL (fail-open).
- **SC-004**: Inmediata coherencia de cotizaciones: el 100 % de las solicitudes a `GET /players/ranking` posteriores a un recálculo o cambio de estrategia activa devuelven las cotizaciones actualizadas sin rastros de valores anteriores.
- **SC-005**: Las consultas a la base de datos PostgreSQL generadas durante un *cache miss* resuelven los filtros de `findPage` y la agregación de `findRanking` mediante *Index Scan*, eliminando los *Seq Scans* sobre la tabla de jugadores activos.

## Assumptions

- Se utiliza Redis 7 en contenedor Docker como tecnología de caché en memoria distribuida para el entorno local y de integración.
- Los clientes envían solicitudes HTTP estándar con parámetros de consulta que pueden llegar desordenados pero con la misma semántica de filtrado.
- El recálculo de cotizaciones y la sincronización con proveedores externos ocurren con menor frecuencia que las lecturas de los usuarios (proporción típica de lecturas/escrituras superior a 20:1), haciendo óptimo el enfoque Cache-Aside.
- Los datos de escudos y tablas de posiciones de competiciones varían con baja frecuencia semanal, por lo que un TTL extendido y la persistencia local en base de datos constituyen un respaldo confiable y seguro.
