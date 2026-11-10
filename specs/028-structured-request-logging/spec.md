# Feature Specification: Logging estructurado y trazabilidad de requests

**Feature Branch**: `028-structured-request-logging`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Logging estructurado y trazabilidad de requests — toda request HTTP que llega al backend queda registrada como un log estructurado en formato JSON (vía `nestjs-pino`), en lugar de texto plano en consola. Cada entrada incluye timestamp, identificador del usuario autenticado (o \"anónimo\" si la ruta es pública), método HTTP y endpoint, parámetros relevantes (query, params y cuerpo del request cuando corresponda), código de respuesta y tiempo de ejecución en milisegundos, capturado de forma global para que ningún endpoint quede afuera. Toda request recibe un Correlation ID: si ya trae uno (header `X-Correlation-Id`) se reutiliza, si no se genera un UUID; queda asociado a todos los logs de esa request y se devuelve en la respuesta (mismo header). Los parámetros sensibles se redactan siempre antes de loguear el cuerpo del request; los cuerpos de respuesta no se loguean. Decisión de diseño: reutilizar el Correlation ID entrante en lugar de generar siempre uno nuevo. Fuera de alcance, aceptado como riesgo: no se propaga el Correlation ID a las llamadas a APIs externas ni a los listeners asíncronos disparados por eventos internos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconstruir qué pasó en una operación puntual (Priority: P1)

Quien opera o desarrolla el sistema recibe un reporte de falla ("mi orden dio error", "la pantalla tardó mucho"). Con el identificador de la request en la mano, filtra los logs por un solo valor y obtiene, en orden, todo lo que el backend registró durante esa operación, sin mezclarlo con las requests concurrentes de otros usuarios.

**Why this priority**: Es el motivo de la feature y la exigencia de observabilidad de la constitución (Principio VII: logs estructurados y Correlation ID propagado en toda la cadena de una request). Sin identificador compartido, diagnosticar un problema en un sistema con tráfico concurrente es adivinar.

**Independent Test**: Enviar dos requests concurrentes que generen más de una línea de log cada una (por ejemplo, una que termina en error y otra exitosa) y verificar que filtrando por el Correlation ID de cada una se obtiene exactamente el conjunto de entradas de esa request y de ninguna otra.

**Acceptance Scenarios**:

1. **Given** una request sin header `X-Correlation-Id`, **When** el backend la procesa, **Then** se genera un identificador único, todas las entradas de log producidas durante esa request lo incluyen y la respuesta lo devuelve en el header `X-Correlation-Id`.
2. **Given** una request que produce varias entradas de log (la de la request y las emitidas por el sistema mientras la procesa, incluido un error), **When** se filtran los logs por su Correlation ID, **Then** aparecen todas, no solo la primera.
3. **Given** dos requests procesándose al mismo tiempo, **When** se filtran los logs por el Correlation ID de una, **Then** no aparece ninguna entrada de la otra.
4. **Given** una request que termina en error (4xx o 5xx, incluidas las rechazadas por falta de autenticación o ruta inexistente), **When** se lee la respuesta, **Then** también incluye el header `X-Correlation-Id`, para que quien la recibió pueda reportarlo.

---

### User Story 2 - Registro automático de toda request con sus datos clave (Priority: P1)

Cada request HTTP que llega al backend deja una entrada de log estructurada con los datos necesarios para entender qué se pidió, quién lo pidió y cómo terminó, sin que cada funcionalidad tenga que acordarse de loguear.

**Why this priority**: Es el registro base sobre el que se apoya la trazabilidad; si algún endpoint queda sin registrar (hoy o en el futuro), la traza tiene huecos.

**Independent Test**: Invocar un endpoint público, uno protegido con credenciales válidas y uno inexistente, y verificar que cada invocación produce una entrada de log en formato estructurado con los campos requeridos.

**Acceptance Scenarios**:

1. **Given** una request a un endpoint protegido hecha por un usuario autenticado, **When** el backend responde, **Then** se registra una entrada con: marca de tiempo, identificador del usuario, método HTTP, endpoint invocado, parámetros de query y de ruta, código de respuesta y tiempo de ejecución en milisegundos.
2. **Given** una request a una ruta pública, o con credenciales ausentes o inválidas, **When** el backend responde, **Then** la entrada de log registra al usuario como "anónimo".
3. **Given** una request con cuerpo (por ejemplo, la creación de una orden), **When** se registra, **Then** la entrada incluye el cuerpo del request, con los campos sensibles redactados.
4. **Given** una request a cualquier endpoint, incluido uno agregado en el futuro sin código de logging propio, **When** el backend responde, **Then** queda registrada igual: el registro no depende de que cada funcionalidad lo invoque.
5. **Given** cualquier request, **When** se registra su finalización, **Then** la entrada contiene el código de estado y el tiempo de ejecución, pero **no** el cuerpo de la respuesta.
6. **Given** el backend en ejecución, **When** se leen sus logs, **Then** todas las entradas (no solo las de requests) son registros estructurados y no texto plano.

---

### User Story 3 - Que los logs nunca expongan credenciales ni datos personales (Priority: P1)

Los logs se copian, se comparten con el equipo y pueden terminar en herramientas de terceros. Nadie debe poder leer en ellos una contraseña, un token, una API key ni datos personales de un usuario.

**Why this priority**: El Principio IV de la constitución prohíbe loguear JWT, contraseñas y datos personales en texto plano "en todas las capas (…) y logs". Registrar cuerpos de request sin redactar violaría esa regla en el primer login.

**Independent Test**: Registrar un usuario y hacer login con credenciales conocidas, emitir una API key, abrir el stream de notificaciones (que transporta el JWT en la URL) y verificar que ni la contraseña, ni el token, ni la API key, ni el email aparecen en ninguna entrada de log, en ningún campo.

**Acceptance Scenarios**:

1. **Given** una request de registro o de login con contraseña, **When** se registra, **Then** el valor de la contraseña no aparece en ningún campo del log; en su lugar figura un marcador de redacción.
2. **Given** una request con un JWT (en el header de autorización o como parámetro de la URL del stream de notificaciones), **When** se registra, **Then** el token no aparece en texto plano en ninguna parte de la entrada, incluido el endpoint/URL registrado.
3. **Given** una request que lleva una API key (header de API key) o que la emite, **When** se registra, **Then** la API key no aparece en texto plano.
4. **Given** un cuerpo que contiene datos personales del usuario (email y nombre de usuario), **When** se registra, **Then** esos campos aparecen redactados.
5. **Given** un campo sensible anidado dentro del cuerpo o con distinto uso de mayúsculas, **When** se registra, **Then** también se redacta: la redacción no depende del endpoint ni de la posición del campo.
6. **Given** una respuesta que contiene un token (por ejemplo, la del login), **When** se registra la request, **Then** el token no aparece, porque los cuerpos de respuesta no se loguean.

---

### User Story 4 - Reutilizar el identificador que ya trae la request (Priority: P2)

Cuando una request llega con un Correlation ID (porque es un reintento del propio cliente o viene de otro servicio interno), el backend lo conserva en lugar de inventar uno nuevo, de modo que una misma operación lógica con reintentos o múltiples llamadas relacionadas se rastree como una sola unidad.

**Why this priority**: Es la decisión de diseño de la feature, pero el valor base (historias 1 y 2) funciona sin ella: si siempre se generara uno nuevo, igual se podría reconstruir cada request individual.

**Independent Test**: Enviar tres requests con el mismo `X-Correlation-Id` válido y verificar que los logs de las tres se recuperan con ese único valor y que cada respuesta devuelve ese mismo valor.

**Acceptance Scenarios**:

1. **Given** una request con un `X-Correlation-Id` bien formado, **When** el backend la procesa, **Then** usa ese mismo valor en todos los logs de la request y lo devuelve en la respuesta.
2. **Given** varias requests (por ejemplo, reintentos) con el mismo `X-Correlation-Id`, **When** se filtran los logs por ese valor, **Then** aparecen las entradas de todas ellas como una sola traza.
3. **Given** una request cuyo `X-Correlation-Id` está vacío, es excesivamente largo o contiene caracteres no permitidos (saltos de línea, comillas, caracteres de control), **When** el backend la procesa, **Then** descarta el valor entrante y genera uno propio, que se usa en los logs y se devuelve en la respuesta.

---

### Edge Cases

- ¿Qué pasa con requests de larga duración, como el stream de notificaciones en vivo? El tiempo de ejecución registrado refleja la duración total de la conexión; el log de la request se emite cuando la conexión termina, y la URL registrada nunca incluye el token que viaja en ella.
- ¿Qué pasa si el cuerpo del request es muy grande? El cuerpo registrado se recorta a un tamaño máximo acotado, con una marca de que fue truncado, para que un request voluminoso no infle los logs.
- ¿Qué pasa si el cuerpo no es JSON válido o está vacío? La request se registra igual, sin cuerpo, y el log no falla ni altera la respuesta.
- ¿Qué pasa con una request rechazada antes de llegar a un controller (sin credenciales, ruta inexistente, cuerpo inválido)? También se registra, con su código de respuesta y usuario "anónimo" cuando corresponda, y su respuesta lleva el Correlation ID.
- ¿Qué pasa con requests muy frecuentes y sin valor diagnóstico, como las consultas periódicas al health check? Se registran como cualquier otra: la política de ruido o muestreo no forma parte de esta feature.
- ¿Qué pasa si el sistema que consume los logs falla o la salida de logs se bloquea? El procesamiento de las requests no debe fallar ni cambiar su respuesta por un problema de logging.
- ¿Qué pasa con las tareas programadas (sincronizaciones semanales) y el arranque del backend? Sus logs son estructurados, pero no tienen Correlation ID de request porque no nacen de una request HTTP.
- ¿Qué pasa con un flujo que sigue ejecutándose de forma asíncrona después de que la request respondió, o con las llamadas a Football-Data y WhoScored? Quedan fuera del alcance (ver "Fuera de alcance, aceptado como riesgo"): sus logs no llevan el Correlation ID de la request que los originó.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST registrar cada request HTTP que llega al backend como una entrada de log estructurada y legible por máquina, sin excepciones por endpoint, incluidas las respondidas con error y las rechazadas por falta de autenticación o por ruta inexistente.
- **FR-002**: El registro MUST ser global y automático: un endpoint nuevo MUST quedar registrado sin que su código invoque el logging. Ningún endpoint queda afuera por omisión.
- **FR-003**: Cada entrada de request MUST incluir como mínimo: marca de tiempo, identificador del usuario autenticado (o "anónimo"), método HTTP, endpoint invocado, parámetros de query y de ruta, cuerpo del request cuando exista (ya redactado), código de respuesta y tiempo de ejecución en milisegundos.
- **FR-004**: Cuando la request no tiene un usuario autenticado (ruta pública, credenciales ausentes o inválidas), el identificador de usuario registrado MUST ser "anónimo".
- **FR-005**: Todas las salidas de log del backend (las de requests, las de la aplicación y las de errores) MUST emitirse en formato estructurado, reemplazando el texto plano actual.
- **FR-006**: Toda request MUST tener un Correlation ID. Si trae un header `X-Correlation-Id` válido, MUST reutilizarse ese valor; si no lo trae o no es válido, el sistema MUST generar un identificador único.
- **FR-007**: Un `X-Correlation-Id` entrante MUST validarse antes de reutilizarse: se acepta solo si no está vacío, no excede una longitud máxima acotada y contiene únicamente caracteres seguros (alfanuméricos y separadores comunes). De lo contrario MUST descartarse y generarse uno nuevo.
- **FR-008**: El Correlation ID MUST asociarse a **todas** las entradas de log emitidas durante el procesamiento de esa request, por cualquier componente del sistema (incluidos los errores), sin que cada componente deba recibirlo ni pasarlo manualmente.
- **FR-009**: La respuesta a toda request MUST devolver el Correlation ID en el header `X-Correlation-Id`, también cuando la respuesta es un error.
- **FR-010**: Dos requests concurrentes MUST tener sus trazas aisladas: filtrar por un Correlation ID nunca devuelve entradas de otra request con un identificador distinto.
- **FR-011**: Los datos sensibles MUST redactarse antes de registrarse, en cualquier endpoint y a cualquier profundidad del cuerpo, sin distinguir mayúsculas de minúsculas: contraseñas, JWT y cualquier token de autenticación, API keys y credenciales en general, y los datos personales del usuario (email y nombre de usuario). Esto incluye los headers de autorización y de API key y cualquier token que viaje en la URL (como el del stream de notificaciones).
- **FR-012**: Los datos sensibles redactados MUST aparecer con un marcador fijo de redacción; nunca se registra el valor original, ni parcial.
- **FR-013**: Los cuerpos de respuesta MUST NOT registrarse; solo el código de estado y el tiempo de ejecución.
- **FR-014**: El cuerpo de request registrado MUST tener un tamaño máximo acotado; si lo excede, se trunca y se marca como truncado.
- **FR-015**: Un fallo del logging (salida bloqueada, valor no serializable) MUST NOT alterar el código ni el cuerpo de la respuesta ni hacer fallar la request.
- **FR-016**: El Correlation ID MUST NOT propagarse a las llamadas salientes a APIs externas ni a los listeners asíncronos de eventos internos: queda fuera de alcance y no se intenta.
- **FR-017**: La decisión de reutilizar el Correlation ID entrante cuando existe, en lugar de generar siempre uno nuevo, MUST quedar documentada con su justificación (ver "Decisión de diseño").

### Key Entities

- **Entrada de log de request**: registro estructurado de una request HTTP finalizada. Atributos: marca de tiempo, Correlation ID, usuario (identificador o "anónimo"), método, endpoint, query, parámetros de ruta, cuerpo del request redactado (opcional, posiblemente truncado), código de respuesta, duración en milisegundos.
- **Correlation ID**: identificador de una request (o de una operación lógica repetida) que vincula todas las entradas de log producidas durante su procesamiento y que viaja de vuelta al cliente en la respuesta.
- **Campo sensible**: dato que nunca se registra en claro (contraseña, token, API key, credencial, dato personal del usuario), reemplazado por un marcador de redacción.

## Decisión de diseño

**Se reutiliza el Correlation ID entrante cuando existe; solo se genera uno nuevo si falta o no es válido.**

- **Qué se decidió**: si la request trae `X-Correlation-Id` bien formado, ese es el identificador de toda la traza; el backend no lo reemplaza.
- **Por qué**: una misma operación lógica puede materializarse en varias requests (el cliente que reintenta tras un timeout, o un servicio interno que encadena llamadas). Si el borde del sistema generara siempre un identificador nuevo, esa operación aparecería fragmentada en identificadores distintos y habría que reconstruir a mano qué trazas corresponden a la misma. Reutilizar el valor entrante permite seguirla como una sola unidad.
- **Costo y mitigación**: el identificador entrante lo controla quien llama, así que podría usarse para falsear o ensuciar los logs (valores larguísimos, saltos de línea, texto que simule otras entradas) o para que dos operaciones distintas compartan identificador. Por eso se valida longitud y caracteres (FR-007) y se genera uno propio ante cualquier valor dudoso. Que dos clientes reutilicen un mismo valor no afecta la seguridad (el Correlation ID es solo informativo y no concede acceso a nada), a lo sumo mezcla trazas que ese cliente decidió unir.
- **Alternativa descartada**: generar siempre un identificador propio y guardar el entrante como campo aparte. Se descarta porque obliga a filtrar por dos valores para seguir una operación con reintentos, justo lo que la feature busca evitar.

## Fuera de alcance, aceptado como riesgo

- El Correlation ID **no** se propaga a las llamadas salientes del sistema a Football-Data y WhoScored, que además no están bajo nuestro control.
- El Correlation ID **no** se propaga a los listeners asíncronos disparados por eventos internos (por ejemplo, la cadena `quote.recalculated` → alertas → notificaciones). Los logs de esos listeners son estructurados pero no llevan el identificador de la request que originó el evento.
- **Consecuencia aceptada**: se puede correlacionar todo lo que ocurre dentro del ciclo de vida de una request HTTP, pero no un flujo que continúa después de que la request ya respondió.
- También quedan fuera: métricas de latencia y tasa de error (otra exigencia del Principio VII, otra feature), almacenamiento y consulta centralizada de logs, rotación/retención de logs, muestreo o filtrado de ruido, y propagar el identificador a un frontend o a herramientas de monitoreo externas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dado el Correlation ID de una request, quien opera el sistema recupera el 100% de las entradas de log de esa request filtrando por ese único valor, y ninguna entrada de otra request.
- **SC-002**: El 100% de las respuestas del backend (éxitos y errores, incluidas 401 y 404) devuelven el header `X-Correlation-Id`.
- **SC-003**: El 100% de las requests que llegan al backend generan una entrada de log con todos los campos mínimos de FR-003, incluidas las de endpoints agregados después de esta feature sin código de logging propio.
- **SC-004**: En una prueba con credenciales, token y API key conocidos (registro, login, emisión de API key y stream de notificaciones), esos valores, el email y el nombre de usuario aparecen en 0 entradas de log, en ningún campo.
- **SC-005**: El 100% de las requests con un `X-Correlation-Id` válido conservan ese mismo valor en los logs y en la respuesta; el 100% de las que traen uno inválido reciben un valor propio.
- **SC-006**: Ninguna entrada de log contiene el cuerpo de una respuesta.
- **SC-007**: El registro de requests no agrega más de 5 ms a la respuesta de un usuario en condiciones normales, y un fallo del sistema de logs no cambia el resultado de ninguna request.
- **SC-008**: Ante un reporte de error con su Correlation ID, quien investiga identifica la secuencia completa de la operación sin consultar más de un filtro y sin adivinar a qué request corresponde cada línea.

## Assumptions

- Hoy el backend emite logs en texto plano mediante el logger por defecto de Nest (varios servicios y el filtro global de excepciones lo usan). Esta feature reemplaza ese formato para todo el backend, sin cambiar qué se loguea en cada servicio.
- El usuario autenticado se identifica por su identificador interno (UUID), no por su email ni su nombre, para no registrar datos personales.
- Se consideran datos sensibles al menos: contraseñas, JWT y cualquier token, API keys, headers de autorización, credenciales en general, emails y nombres de usuario. Esto se deriva de los Principios IV y VII de la constitución; el email se redacta aunque la descripción original sólo mencione contraseñas y tokens.
- "Cuerpo del request cuando corresponda" significa: se registra para requests que traen cuerpo (altas, login, creación de órdenes/alertas, etc.) y se omite si no hay.
- El tamaño máximo del cuerpo registrado y la longitud máxima del Correlation ID son valores acotados y razonables (del orden de unos pocos miles de caracteres para el cuerpo y de decenas de caracteres para el identificador); los valores exactos se fijan en la planificación.
- Los logs se emiten por la salida estándar del proceso; recolectarlos, almacenarlos o consultarlos es responsabilidad de la infraestructura y no de esta feature.
- El health check (`027-health-check`) y cualquier otro endpoint público se registran como el resto; no hay excepciones por endpoint.
- Esta feature no cambia contratos de endpoints existentes salvo el header de respuesta adicional `X-Correlation-Id`, por lo que no exige cambios en el frontend; el header debe quedar legible para clientes de otro origen si hace falta, lo cual se resuelve en la planificación.
- La documentación Swagger y la colección de Postman deben reflejar el nuevo header de respuesta (Principios VIII y X).
