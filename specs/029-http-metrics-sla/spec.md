# Feature Specification: Métricas técnicas (latencia y tasa de error) y SLA por endpoint

**Feature Branch**: `029-http-metrics-sla`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Métricas técnicas (latencia y tasa de error) y SLA por endpoint — el sistema expone `GET /metrics` en formato texto de Prometheus (vía `prom-client`), sin autenticación, igual que `/health`. Dos métricas: un histograma de duración de request (etiquetas de método, ruta y código de estado; permite p50/p95/p99 por endpoint) y un contador de requests totales con las mismas etiquetas (permite la tasa de error). La recolección no depende de que la request llegue a un controller: se captura en el mismo punto que el logging y el Correlation ID —sobre el evento de finalización de la respuesta, a nivel de middleware— para que las rechazadas por un guard (401/403) o dirigidas a una ruta inexistente (404) no queden invisibles. Una ruta que no matchea ningún endpoint se agrupa bajo un valor fijo genérico en la etiqueta de ruta, para acotar la cardinalidad. La tasa de error se define sobre 5xx; los 4xx se cuentan aparte. Se define un SLA objetivo (latencia p95 y tasa de error 5xx) para cada endpoint de la tabla de la Sección 4 del documento de visión, documentado junto al código y verificable contra las métricas expuestas. Decisión de diseño: middleware sobre el evento de finalización en lugar de un Interceptor. Fuera de alcance, aceptado como riesgo: los SLA son objetivos declarados, no derivados de datos de producción, y no hay alerting configurado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar las métricas sin credenciales (Priority: P1)

Una herramienta de monitoreo (un scraper de Prometheus) consulta periódicamente el endpoint de métricas del backend sin poseer un token de usuario, y obtiene la duración y el conteo de las requests atendidas, listos para calcular percentiles de latencia y tasa de error por endpoint.

**Why this priority**: Es el propósito de la feature y la exigencia de observabilidad de la constitución (Principio VII: métricas de latencia y de tasa de error). Sin un endpoint consultable por la herramienta, no hay forma de verificar ningún SLA.

**Independent Test**: Hacer algunas requests a endpoints distintos, consultar `GET /metrics` sin ningún encabezado de autenticación y verificar que responde con éxito, en el formato de texto esperado por Prometheus, e incluye una serie de duración y una de conteo por cada combinación de método, ruta y código de estado observada.

**Acceptance Scenarios**:

1. **Given** el backend en ejecución, **When** se consulta `GET /metrics` sin credenciales, **Then** responde 200 (nunca 401) con las métricas en formato de texto de Prometheus.
2. **Given** requests ya atendidas a distintos endpoints, **When** se consulta `/metrics`, **Then** existe una medida de duración (con intervalos acumulativos) y un contador de requests, ambos etiquetados con método, ruta y código de estado.
3. **Given** el resto de los endpoints protegidos del sistema, **When** se consulta cualquiera de ellos sin credenciales, **Then** siguen rechazando la consulta: la exención aplica únicamente a `/metrics` (y a los endpoints ya públicos).
4. **Given** una consulta a `/metrics`, **When** se leen las métricas, **Then** sólo figuran las dos métricas de requests definidas y sus etiquetas, sin datos de usuarios, identificadores, credenciales ni contenido de las requests.

---

### User Story 2 - Medir toda request, incluidas las rechazadas (Priority: P1)

Quien evalúa la disponibilidad necesita que las requests rechazadas por falta de autenticación o permisos (401/403), las dirigidas a rutas inexistentes (404) y las rechazadas por un cuerpo ilegible (400) aparezcan en las métricas con su código real, aunque nunca lleguen a un controller. Son justamente los casos que más importan para una tasa de error honesta.

**Why this priority**: Una medición que sólo ve lo que llega al controller subestima el tráfico real y oculta los rechazos; es el error de diseño que la feature de logging ya evitó y que esta feature no debe repetir.

**Independent Test**: Enviar una request sin token (401), una a una ruta inexistente (404), una con JSON mal formado (400) y una exitosa, y verificar que cada una incrementa el contador y la duración con su propio código de estado.

**Acceptance Scenarios**:

1. **Given** una request a un endpoint protegido sin credenciales, **When** el sistema responde 401, **Then** el contador de esa ruta con código 401 aumenta en uno y la duración queda registrada.
2. **Given** una request a una ruta que no existe, **When** el sistema responde 404, **Then** el contador y la duración se registran con código 404.
3. **Given** una request con cuerpo JSON mal formado que se rechaza antes de llegar a ninguna funcionalidad, **When** el sistema responde 400, **Then** también queda contada y medida.
4. **Given** una request que termina en error del servidor (5xx), **When** responde, **Then** queda contada y medida con su código 5xx.
5. **Given** cualquier request atendida, **When** se compara el total del contador con las entradas del log de requests de la misma ventana, **Then** coinciden: cada request cuenta exactamente una vez en cada fuente.

---

### User Story 3 - Cardinalidad de etiquetas acotada (Priority: P1)

Quien opera el sistema necesita que el volumen de series de las métricas no crezca sin límite por culpa de URLs arbitrarias o de identificadores variables, ya sea por error o por abuso deliberado.

**Why this priority**: Sin este límite, cualquiera puede degradar el sistema de monitoreo generando una serie nueva por cada URL distinta; es un problema de disponibilidad del propio monitoreo, no sólo de prolijidad.

**Independent Test**: Hacer muchas requests a URLs inexistentes distintas y a un mismo endpoint con muchos identificadores distintos, y verificar que la cantidad de series no aumenta con cada valor nuevo.

**Acceptance Scenarios**:

1. **Given** requests a cientos de URLs inexistentes distintas, **When** se consultan las métricas, **Then** todas aparecen bajo una única etiqueta de ruta de valor fijo genérico, y ninguna serie contiene el path crudo solicitado.
2. **Given** requests al mismo endpoint con identificadores distintos (por ejemplo, el detalle de distintos jugadores), **When** se consultan las métricas, **Then** aparece una sola serie por el patrón de la ruta (`/players/:id`), sin los identificadores.
3. **Given** una request cuyo método HTTP no pertenece al conjunto estándar, **When** se mide, **Then** se agrupa bajo un valor fijo genérico de método en lugar de crear una serie por cada método inventado.
4. **Given** una request con query string, **When** se mide, **Then** la query no forma parte de la etiqueta de ruta.

---

### User Story 4 - Una tasa de error honesta: 5xx separados de 4xx (Priority: P1)

Quien define y revisa el SLA necesita calcular la tasa de error de un endpoint sobre las fallas reales del servicio (5xx) sin que los errores de los clientes (4xx: validación, autenticación, recursos no encontrados) la distorsionen, y conservar a la vez la visibilidad de los 4xx para detectar abuso o problemas de integración.

**Why this priority**: Mezclar ambos haría que un endpoint con buena disponibilidad pareciera estar fallando sólo porque los usuarios envían requests inválidas; el SLA debe reflejar la salud del servicio.

**Independent Test**: Generar requests con respuestas 200, 400, 401, 404 y 500 sobre un mismo endpoint y verificar que, a partir de las métricas, la tasa de 5xx se calcula sólo sobre las 5xx y que los 4xx son consultables por separado.

**Acceptance Scenarios**:

1. **Given** un endpoint que recibió 90 respuestas 200, 8 respuestas 4xx y 2 respuestas 5xx, **When** se calcula su tasa de error desde las métricas, **Then** el resultado es 2% (2 de 100), no 10%.
2. **Given** las mismas métricas, **When** se consultan los 4xx de ese endpoint, **Then** se obtienen por separado, por código de estado (400, 401, 404, etc.).
3. **Given** una respuesta 503 del health check por base de datos caída, **When** se mide, **Then** cuenta como 5xx del endpoint de salud: es una falla real del servicio.

---

### User Story 5 - SLA declarado y verificable por endpoint (Priority: P2)

El equipo necesita un objetivo explícito de latencia (p95) y de tasa de error 5xx para cada endpoint, guardado junto al código y no en un documento aparte que se desincronice, de modo que pueda contrastarse de forma directa con las métricas reales que expone el sistema.

**Why this priority**: Convierte las métricas en una evaluación de cumplimiento. Es P2 porque las métricas (historias 1 a 4) ya aportan valor sin él.

**Independent Test**: Para cada endpoint del sistema, localizar su entrada de SLA junto al código; verificar que existe, que usa el mismo identificador de ruta que la etiqueta de las métricas y que sus umbrales pueden compararse con lo que se mide.

**Acceptance Scenarios**:

1. **Given** el conjunto de endpoints publicados por el sistema, **When** se revisa la declaración de SLA, **Then** cada endpoint tiene exactamente una entrada con su objetivo de latencia p95 (o la indicación de que no aplica) y su objetivo de tasa de error 5xx.
2. **Given** la declaración de SLA, **When** se la compara con las etiquetas de ruta de las métricas, **Then** los identificadores coinciden, de modo que cada objetivo se puede evaluar sobre su serie.
3. **Given** un endpoint nuevo agregado al sistema sin entrada de SLA (o una entrada de SLA de un endpoint que ya no existe), **When** corren las verificaciones automáticas del proyecto, **Then** fallan y señalan la discrepancia.
4. **Given** cada umbral de latencia declarado, **When** se observa cómo se agrupan las duraciones en las métricas, **Then** existe un límite de intervalo exactamente en ese umbral, de modo que "p95 ≤ objetivo" pueda verificarse sin interpolar.

---

### Edge Cases

- ¿Qué pasa con las conexiones de larga duración, como el stream de notificaciones en vivo? La duración medida sería la de toda la conexión y distorsionaría los percentiles: se cuentan en el contador de requests (para su tasa de error) pero **no** entran en la medida de latencia, y su SLA no tiene objetivo de latencia.
- ¿Qué pasa con las requests que el cliente corta antes de recibir la respuesta? Se miden al cerrarse la conexión, con el código de estado que el sistema alcanzó a asignar; no se descartan.
- ¿Qué pasa con las consultas a `/metrics` y a `/health`? Se miden como cualquier otra request (sus propias series), para que el endpoint de salud también tenga su tasa de error y su latencia.
- ¿Qué pasa con las consultas previas de CORS (`OPTIONS`)? Se miden con método `OPTIONS` y, como se resuelven antes de la ruta, caen bajo la ruta genérica; son separables por método.
- ¿Qué pasa con una request rechazada antes de resolverse la ruta (cuerpo JSON ilegible, método no estándar)? Va bajo la ruta genérica: el patrón de ruta no se conoce todavía y el path crudo no se usa nunca como etiqueta.
- ¿Qué pasa si se reinicia el backend? Los contadores y las duraciones empiezan de cero; quien los consulta debe tolerar reinicios (los cálculos de tasa lo hacen por diseño).
- ¿Qué pasa si la recolección de métricas falla? No debe alterar la respuesta que recibe el usuario ni su código de estado.
- ¿Qué pasa si `/metrics` recibe tráfico muy frecuente o de varios clientes a la vez? La consulta es liviana y de sólo lectura; no degrada la atención de las demás requests.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer un endpoint de consulta `GET /metrics` que devuelva las métricas de requests en el formato de texto de Prometheus.
- **FR-002**: `GET /metrics` MUST ser accesible sin autenticación (exento del JWT, igual que `/health`); los demás endpoints MUST seguir exigiendo la autenticación que ya tienen.
- **FR-003**: El sistema MUST exponer exactamente dos métricas de requests: una medida de **duración** con intervalos acumulativos (que permita calcular p50, p95 y p99) y un **contador de requests totales**, ambas etiquetadas con método HTTP, ruta y código de estado.
- **FR-004**: La medición MUST ser global y automática, independiente de que la request llegue a un controller: MUST cubrir las requests exitosas, las rechazadas por autenticación o permisos (401/403), las dirigidas a rutas inexistentes (404), las rechazadas por un cuerpo ilegible (400) y los errores del servidor (5xx).
- **FR-005**: La medición MUST registrar cada request al finalizar su respuesta, en el mismo punto del ciclo de vida en que ya se captura el logging y el Correlation ID, de modo que el total contado coincida con la cantidad de entradas del log de requests.
- **FR-006**: La etiqueta de ruta MUST ser el **patrón** de la ruta resuelta (por ejemplo `/players/:id`), nunca el path crudo solicitado, y MUST NOT incluir identificadores, query string ni valores de la request.
- **FR-007**: Una request que no resuelve a ningún endpoint existente (404, o rechazada antes de resolver la ruta) MUST agruparse bajo un único valor fijo y genérico de la etiqueta de ruta, documentado, en lugar del path solicitado (acota la cardinalidad).
- **FR-008**: La etiqueta de método MUST limitarse a un conjunto cerrado de métodos HTTP estándar; cualquier otro valor MUST agruparse bajo un valor fijo genérico.
- **FR-009**: Los códigos de estado MUST registrarse tal cual los devolvió el sistema, de modo que los 4xx y los 5xx sean consultables por separado.
- **FR-010**: La tasa de error de un endpoint (para su SLA) MUST definirse como la proporción de respuestas 5xx sobre el total de requests de ese endpoint; los 4xx NO forman parte de esa tasa y se siguen contando por separado.
- **FR-011**: Las requests de larga duración (el stream de notificaciones en vivo) MUST contarse en el contador de requests pero MUST NOT incorporarse a la medida de duración, para no distorsionar los percentiles de latencia.
- **FR-012**: Las métricas MUST NOT contener datos de usuarios, identificadores de recursos, credenciales ni contenido de las requests o de las respuestas.
- **FR-013**: Un fallo de la recolección de métricas MUST NOT alterar la respuesta, el código de estado ni la duración percibida por el usuario.
- **FR-014**: El sistema MUST declarar un SLA objetivo —latencia p95 y tasa de error 5xx— para cada endpoint publicado (tabla "SLA por endpoint" de esta spec), en un artefacto **versionado junto al código fuente**, no en un documento aparte.
- **FR-015**: Cada entrada de SLA MUST identificarse con el mismo método y patrón de ruta que usan las etiquetas de las métricas, de modo que cada objetivo pueda evaluarse sobre su serie.
- **FR-016**: Los intervalos de la medida de duración MUST incluir un límite exactamente en cada umbral de latencia declarado, para poder verificar "p95 ≤ objetivo" sin interpolación.
- **FR-017**: Las verificaciones automáticas del proyecto MUST fallar si existe un endpoint publicado sin entrada de SLA o una entrada de SLA sin endpoint publicado.
- **FR-018**: La decisión de capturar las métricas a nivel de middleware sobre el evento de finalización de la respuesta, en lugar de un Interceptor, MUST quedar documentada con su justificación (ver "Decisión de diseño").
- **FR-019**: La documentación de la API (Swagger) y la colección de Postman del proyecto MUST reflejar el nuevo endpoint `GET /metrics` y su formato de respuesta.

### Key Entities

- **Medida de duración de request**: distribución de la duración de las requests atendidas, agrupada por método, ruta y código de estado; permite obtener percentiles de latencia por endpoint.
- **Contador de requests**: cantidad acumulada de requests atendidas, con las mismas etiquetas; permite obtener tasa de requests y tasa de error.
- **Etiquetas**: método (conjunto cerrado de valores estándar más un valor genérico), ruta (patrón de la ruta o valor genérico para las no resueltas) y código de estado.
- **Objetivo de SLA**: por endpoint (método + patrón de ruta), un objetivo de latencia p95 (o "no aplica") y un objetivo de tasa de error 5xx.

## SLA por endpoint

Objetivos **declarados** para este trabajo (no derivados de tráfico real). Cada fila usa el método y el patrón de ruta de las etiquetas de las métricas. La tasa de error es la proporción de respuestas 5xx. Un guion en la latencia indica que no aplica.

| Clase | Endpoint | p95 de latencia | Tasa de error 5xx |
|-------|----------|-----------------|-------------------|
| Autenticación | `POST /auth/register` | ≤ 600 ms | ≤ 0,5 % |
| Autenticación | `POST /auth/login` | ≤ 600 ms | ≤ 0,5 % |
| Autenticación | `POST /auth/api-key` | ≤ 600 ms | ≤ 0,5 % |
| Lectura | `GET /auth/me` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /players` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /players/:id` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /players/:id/quotes` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /players/:id/order-book` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /users/:id/portfolio` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /orders` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /orders/history` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /alerts` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /notifications` | ≤ 300 ms | ≤ 0,5 % |
| Lectura | `GET /users/me/strategies` | ≤ 300 ms | ≤ 0,5 % |
| Lectura calculada | `GET /players/ranking` | ≤ 800 ms | ≤ 0,5 % |
| Lectura calculada | `GET /players/:id/valuation` | ≤ 800 ms | ≤ 0,5 % |
| Escritura | `POST /alerts` | ≤ 500 ms | ≤ 0,5 % |
| Escritura | `DELETE /alerts/:id` | ≤ 500 ms | ≤ 0,5 % |
| Escritura | `PATCH /notifications/:id/read` | ≤ 500 ms | ≤ 0,5 % |
| Escritura | `PATCH /notifications/read-all` | ≤ 500 ms | ≤ 0,5 % |
| Escritura | `PATCH /users/me/strategies/:id/select` | ≤ 500 ms | ≤ 0,5 % |
| Escritura | `PATCH /users/me/strategies/:id/weights` | ≤ 500 ms | ≤ 0,5 % |
| Escritura | `PATCH /users/me/strategies/:id/position-weights/:position` | ≤ 500 ms | ≤ 0,5 % |
| Mercado | `POST /orders` | ≤ 800 ms | ≤ 0,5 % |
| Mercado | `DELETE /orders/:id` | ≤ 800 ms | ≤ 0,5 % |
| Sistema | `POST /sync/whoscored` | ≤ 1 s | ≤ 1 % |
| Sistema | `GET /sync/whoscored/:runId` | ≤ 300 ms | ≤ 1 % |
| Sistema | `POST /sync/football-data` | ≤ 1 s | ≤ 1 % |
| Sistema (larga duración) | `POST /quotes/recalculate` | — | ≤ 1 % |
| Sistema (larga duración) | `POST /admin/simulate-market` | — | ≤ 1 % |
| Tiempo real | `GET /notifications/stream` | — | ≤ 0,5 % |
| Técnico | `GET /` | ≤ 100 ms | ≤ 0,5 % |
| Técnico | `GET /health` | ≤ 250 ms | ≤ 0,5 % |
| Técnico | `GET /metrics` | ≤ 250 ms | ≤ 0,5 % |

## Decisión de diseño

**La recolección de métricas se hace a nivel de middleware, sobre el evento de finalización de la respuesta, y no con un Interceptor.**

- **Qué se decidió**: cada request se mide cuando su respuesta termina, en el mismo punto del ciclo de vida donde ya se captura el log de requests y se asigna el Correlation ID (feature `028-structured-request-logging`), y no dentro del pipeline de controllers.
- **Por qué**: un Interceptor sólo corre si la request llega al controller. Una request rechazada por un guard (401/403), dirigida a una ruta inexistente (404) o rechazada por un cuerpo ilegible (400) nunca lo atraviesa, y quedaría invisible en las métricas. Esos son justamente los casos más relevantes para calcular una tasa de error honesta; medir sólo lo que llega al controller subestimaría el tráfico real y ocultaría los rechazos. Es la misma razón que ya llevó a descartar el Interceptor en el feature de logging.
- **Consecuencia**: las métricas y el log de requests comparten el punto de captura, así que el total contado debe coincidir con la cantidad de entradas del log (FR-005); la duración medida debe coincidir con la que se registra en el log.
- **Alternativa descartada**: Interceptor global (huecos en los rechazos, descartado), o un Interceptor más un middleware sólo para los casos que se le escapan (dos rutas de medición con riesgo de contar dos veces).

## Fuera de alcance, aceptado como riesgo

- **Los SLA son objetivos declarados, no medidos**: no hay tráfico histórico de producción que los valide empíricamente; se fijaron como objetivos razonables para este trabajo y podrán ajustarse cuando existan datos reales.
- **No hay alerting**: las métricas se exponen, pero no se configura Alertmanager ni reglas automatizadas. Si un SLA se incumple, nadie se entera automáticamente; detectarlo depende de quien consulte `/metrics` (o un tablero) a mano.
- También quedan fuera: métricas del proceso (CPU, memoria, GC), métricas de negocio (órdenes ejecutadas, cotizaciones), tableros, almacenamiento y retención de las series, y protección de red del endpoint `/metrics`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las consultas a `/metrics` sin credenciales reciben éxito, mientras que el 100% de las consultas sin credenciales a los demás endpoints protegidos siguen siendo rechazadas.
- **SC-002**: El 100% de las requests de una muestra mixta (éxito, 400 de cuerpo ilegible, 401, 404 y 5xx) quedan reflejadas en las métricas con su código real, y el total del contador coincide con la cantidad de entradas del log de requests de la misma ventana.
- **SC-003**: Tras 1.000 requests a URLs inexistentes distintas, el número de series de las métricas no crece con cada URL nueva: todas se agrupan bajo una única ruta genérica, y ninguna serie contiene un path crudo ni un identificador.
- **SC-004**: Con un conjunto conocido de respuestas (por ejemplo 90 × 200, 8 × 4xx y 2 × 5xx en un endpoint), la tasa de error calculada desde las métricas es 2% (sólo 5xx), y los 4xx se obtienen por separado.
- **SC-005**: El 100% de los endpoints publicados tienen una entrada de SLA y el 100% de las entradas de SLA corresponden a un endpoint publicado; las verificaciones automáticas lo comprueban.
- **SC-006**: Para cada endpoint con objetivo de latencia, existe en las métricas un límite de intervalo exactamente en el umbral declarado, de modo que el cumplimiento del p95 se verifica sin interpolar.
- **SC-007**: La medición no agrega más de 2 ms a la respuesta de un usuario en condiciones normales, y un fallo de la recolección no cambia el resultado de ninguna request.
- **SC-008**: Ninguna métrica expuesta contiene datos de usuarios, identificadores de recursos, credenciales, query strings ni contenido de requests o respuestas.

## Assumptions

- **El documento de visión no está en el repositorio.** La tabla de la Sección 4 mencionada en el pedido no figura en el código ni en las specs existentes, así que la tabla "SLA por endpoint" de esta spec se armó con **todos los endpoints realmente publicados por el backend** (más los técnicos `/`, `/health` y `/metrics`). Es el criterio que cubre cualquier tabla de endpoints del enunciado; si la Sección 4 define un subconjunto, otros nombres de ruta o umbrales distintos, se ajusta la tabla y esta decisión se revisa. (Constitución, Principio XII: la ambigüedad queda resuelta como decisión explícita con justificación.)
- Los umbrales (p95 y tasa de 5xx) son objetivos declarados y deliberadamente conservadores, agrupados por clase de operación: autenticación y hashing más lenta (600 ms), lecturas simples (300 ms), lecturas con cálculo (800 ms), escrituras (500 ms), órdenes de mercado con cruce (800 ms), disparos de sincronización (1 s) y endpoints técnicos (100–250 ms); 0,5 % de 5xx como regla general y 1 % para operaciones de sistema que dependen de terceros.
- Los endpoints de larga duración (`recalculate`, `simulate-market`) y el stream en vivo no tienen objetivo de latencia: su duración depende del trabajo o de la conexión, no de la capacidad de respuesta.
- El sistema corre como una única instancia; las métricas son por proceso y se reinician con él. Un despliegue con varias instancias exigiría que el scraper consulte cada una, lo cual excede esta feature.
- La herramienta de monitoreo consulta `/metrics` desde la red del despliegue. Exponerlo sin autenticación revela nombres de rutas y volúmenes de tráfico, pero ningún dato de usuarios; se acepta igual que ya se aceptó para `/health`, y restringir el acceso por red queda a cargo de la infraestructura.
- El formato, las etiquetas y la biblioteca de métricas (Prometheus / `prom-client`) forman parte del pedido y se mencionan sólo en el campo **Input** y en el nombre del endpoint; los requisitos describen el comportamiento.
- Dependencias: `027-health-check` (endpoint público y su 503) y `028-structured-request-logging` (punto de captura compartido: el middleware previo al procesamiento del cuerpo y la asignación del Correlation ID).
- Por los Principios VIII y X, la feature agrega un endpoint nuevo y exige Swagger y Postman actualizados; no requiere cambios de frontend ni de base de datos.
