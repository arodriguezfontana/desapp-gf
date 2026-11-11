# Feature Specification: Health check del backend

**Feature Branch**: `027-health-check`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Health check del backend — el backend expone un endpoint `GET /health` que informa si el sistema está en condiciones de atender requests. Devuelve 200 con `{ status: "ok", ... }` cuando la base de datos responde, y 503 con `{ status: "error", ... }` cuando no. El cuerpo detalla, por cada dependencia chequeada, su estado individual (`up`/`down`). La única dependencia verificada es la base de datos; no se verifican las integraciones externas (Football-Data, WhoScored) porque se sincronizan por tareas programadas y no se invocan durante un request de usuario. El endpoint es accesible sin autenticación. No expone información sensible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber si el sistema puede atender requests (Priority: P1)

Una herramienta de monitoreo o el orquestador de despliegue consulta periódicamente el endpoint de salud para decidir si el backend está en condiciones de recibir tráfico. Obtiene una respuesta que indica de forma inequívoca —por el código de estado y por el cuerpo— si el sistema está sano o no.

**Why this priority**: Es el propósito central de la feature y la exigencia de observabilidad de la constitución (Principio VII). Hoy el endpoint existe pero siempre responde "ok", aunque la base de datos esté caída: un health check que no puede fallar no sirve para decidir nada.

**Independent Test**: Con la base de datos disponible, consultar el endpoint de salud y verificar que responde éxito con estado "ok"; con la base de datos inaccesible, verificar que responde indisponibilidad con estado "error". Se prueba sin necesidad de ninguna otra funcionalidad del sistema.

**Acceptance Scenarios**:

1. **Given** el backend en ejecución y la base de datos respondiendo, **When** se consulta el endpoint de salud, **Then** la respuesta indica éxito (200) y el estado general es "ok".
2. **Given** el backend en ejecución pero la base de datos inaccesible o sin responder, **When** se consulta el endpoint de salud, **Then** la respuesta indica servicio no disponible (503) y el estado general es "error".
3. **Given** la base de datos que estaba caída y se recupera, **When** se vuelve a consultar el endpoint de salud, **Then** la respuesta vuelve a indicar éxito (200) y estado "ok" sin necesidad de reiniciar el backend.

---

### User Story 2 - Distinguir qué componente está fallando (Priority: P1)

Quien opera el sistema, ante una respuesta de error, necesita saber qué dependencia específica falló y no sólo que "algo" está mal. El cuerpo de la respuesta informa el estado individual de cada componente verificado.

**Why this priority**: Reduce el tiempo de diagnóstico de un incidente: indicar el componente caído evita tener que investigar a ciegas. Junto con la historia 1 conforma el valor mínimo de la feature.

**Independent Test**: Consultar el endpoint con la base de datos disponible y luego inaccesible, y verificar que en cada caso el cuerpo informa el estado de la base de datos como "up" o "down" respectivamente.

**Acceptance Scenarios**:

1. **Given** la base de datos respondiendo, **When** se consulta el endpoint de salud, **Then** el cuerpo incluye el estado de la base de datos como "up".
2. **Given** la base de datos inaccesible, **When** se consulta el endpoint de salud, **Then** el cuerpo incluye el estado de la base de datos como "down", de modo que quien consulta identifica ese componente como el que falla.
3. **Given** cualquier resultado del chequeo, **When** se lee el cuerpo de la respuesta, **Then** cada dependencia verificada aparece con su propio estado individual, separado del estado general.

---

### User Story 3 - Consultar la salud sin autenticarse (Priority: P1)

Una herramienta de monitoreo, un balanceador o el orquestador de despliegue consulta el endpoint de salud sin poseer credenciales de usuario, igual que ocurre con el login y el alta de usuarios.

**Why this priority**: Un health check que exige un token de usuario no puede ser consultado por la infraestructura que lo necesita; sin esta historia, las historias 1 y 2 no son utilizables en la práctica.

**Independent Test**: Consultar el endpoint de salud sin ningún encabezado de autenticación y verificar que la respuesta es la de salud (200 o 503 según el caso) y nunca un rechazo por falta de autenticación (401).

**Acceptance Scenarios**:

1. **Given** una consulta sin credenciales, **When** la base de datos responde, **Then** la respuesta es 200 con estado "ok" (no 401).
2. **Given** una consulta sin credenciales, **When** la base de datos no responde, **Then** la respuesta es 503 con estado "error" (no 401).
3. **Given** el resto de los endpoints protegidos del sistema, **When** se consulta cualquiera de ellos sin credenciales, **Then** siguen rechazando la consulta: la exención aplica únicamente al endpoint de salud.

---

### User Story 4 - Que una caída de los proveedores externos no marque al sistema como no disponible (Priority: P2)

Football-Data y WhoScored sólo se consultan mediante tareas programadas semanales y por sincronizaciones manuales; ninguna request de usuario depende de ellos. Por eso, si alguno de esos proveedores está caído, el health check sigue reportando al sistema como sano, porque el sistema puede seguir atendiendo normalmente todas sus demás funciones.

**Why this priority**: Es una decisión de alcance que evita falsos positivos (alarmas y reinicios innecesarios por un problema que no afecta a los usuarios); es importante pero no bloquea el valor base de las historias anteriores.

**Independent Test**: Con la base de datos disponible y los proveedores externos inaccesibles, consultar el endpoint de salud y verificar que sigue respondiendo 200 con estado "ok" y que el endpoint no realiza ninguna consulta a esos proveedores.

**Acceptance Scenarios**:

1. **Given** la base de datos respondiendo y los proveedores externos caídos o lentos, **When** se consulta el endpoint de salud, **Then** la respuesta es 200 con estado "ok".
2. **Given** cualquier estado de los proveedores externos, **When** se consulta el endpoint de salud, **Then** el endpoint no genera tráfico hacia ellos y su tiempo de respuesta no depende de ellos.
3. **Given** cualquier resultado del chequeo, **When** se lee el cuerpo de la respuesta, **Then** los proveedores externos no figuran como componentes verificados.

---

### Edge Cases

- ¿Qué pasa si la base de datos no responde pero tampoco falla de inmediato (conexión colgada)? El chequeo MUST tener un tiempo máximo de espera; al superarlo la base se reporta como "down" y el endpoint responde 503 en lugar de quedar esperando indefinidamente.
- ¿Qué pasa si el health check se consulta con mucha frecuencia (p. ej. cada pocos segundos por varias herramientas a la vez)? El chequeo MUST ser liviano y no degradar la atención de los demás requests.
- ¿Qué pasa si el chequeo falla por un motivo inesperado distinto de una base caída? Se reporta como "down" para ese componente y estado general "error"; el cuerpo nunca incluye el mensaje interno del error, el detalle de conexión ni un stack trace.
- ¿Qué pasa si la base de datos se recupera? La siguiente consulta refleja el estado actual; el resultado no queda "pegado" a un fallo anterior.
- ¿Qué pasa con la respuesta hoy existente del endpoint (campos `service` y `timestamp`)? Pasa a ser un caso particular de la nueva respuesta; el comportamiento nuevo lo reemplaza y se actualiza la documentación de la API.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer un endpoint de consulta `GET /health` que informe si el backend está en condiciones de atender requests.
- **FR-002**: Cuando la base de datos responde, el endpoint MUST responder con código 200 y un estado general "ok".
- **FR-003**: Cuando la base de datos no responde o no es accesible, el endpoint MUST responder con código 503 y un estado general "error".
- **FR-004**: El cuerpo de la respuesta MUST detallar, por cada dependencia verificada, su estado individual con valor "up" o "down", separado del estado general.
- **FR-005**: La única dependencia verificada MUST ser la conexión a la base de datos relacional del sistema. El chequeo MUST comprobar que la base realmente responde, no sólo que la conexión fue configurada alguna vez.
- **FR-006**: El endpoint MUST NOT verificar ni invocar a Football-Data ni a WhoScored, y una caída de esos proveedores MUST NOT alterar el resultado del health check.
- **FR-007**: El endpoint MUST ser accesible sin autenticación, quedando exento de la validación de JWT por la misma vía explícita que ya usan otras rutas públicas como el login. Los demás endpoints MUST seguir exigiendo autenticación.
- **FR-008**: La respuesta MUST NOT incluir información sensible: ni configuración, ni cadenas o parámetros de conexión, ni credenciales, ni versiones internas, ni mensajes de error crudos o stack traces. Sólo el estado de disponibilidad por componente.
- **FR-009**: El chequeo de la base de datos MUST tener un tiempo máximo de espera acotado; al excederlo, la dependencia se reporta como "down".
- **FR-010**: Cada consulta MUST reflejar el estado actual de las dependencias; el resultado MUST NOT cachearse de forma que oculte una caída o una recuperación reciente.
- **FR-011**: La documentación de la API (Swagger) y la colección de Postman del proyecto MUST reflejar el endpoint, sus respuestas 200 y 503 y la forma del cuerpo.
- **FR-012**: La decisión de verificar únicamente la base de datos como dependencia de salud (y no las APIs externas) MUST quedar documentada con su justificación (ver sección "Decisión de diseño").

### Key Entities

- **Resultado de salud**: el informe que devuelve el endpoint. Contiene un estado general ("ok" o "error") y el detalle por componente.
- **Estado de componente**: el estado de una dependencia verificada ("up" o "down"). Hoy existe un único componente: la base de datos.

## Decisión de diseño

**El health check sólo verifica la base de datos, no las APIs externas.**

- **Qué significa "sano" en este sistema**: el health check responde si el backend puede atender un request de usuario típico. Todos los flujos de usuario (catálogo, cotizaciones, órdenes, portfolio, alertas, notificaciones) dependen de la base de datos y de ninguna otra dependencia en tiempo de request.
- **Por qué no se verifican Football-Data ni WhoScored**: sólo se consultan desde tareas programadas (cron semanales) y sincronizaciones manuales disparadas por operadores. Ninguna request de usuario los invoca. Conforme al Principio I de la constitución (degradación ante fallo del proveedor externo), el sistema sigue funcionando con los datos ya guardados cuando un proveedor cae.
- **Consecuencia de incluirlos**: si el health check dependiera de ellos, una caída de un proveedor haría que el monitoreo o el orquestador consideren al sistema no disponible —con alarmas o reinicios innecesarios— aunque los usuarios no se vean afectados (falso positivo). Además, el endpoint sería lento y dependería de terceros, y las consultas frecuentes de monitoreo generarían tráfico no deseado hacia esos proveedores.
- **Alternativa descartada**: reportar los proveedores como componentes informativos que no afectan el estado general. Se descarta por ahora para mantener el chequeo liviano y sin tráfico externo; queda abierta para una feature futura (por ejemplo, el estado de la última sincronización) si se la necesita.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ante una caída de la base de datos, el 100% de las consultas al endpoint de salud reciben una respuesta de no disponibilidad (503) con la base marcada como "down", y ninguna recibe "ok".
- **SC-002**: Con la base de datos disponible, el 100% de las consultas al endpoint de salud reciben éxito (200) con la base marcada como "up", independientemente del estado de los proveedores externos.
- **SC-003**: Tras recuperarse la base de datos, la siguiente consulta al endpoint de salud refleja el estado sano, sin reiniciar el backend.
- **SC-004**: El endpoint responde en menos de 1 segundo cuando la base de datos está sana, y en menos de 5 segundos aun cuando la base no responde (nunca queda esperando indefinidamente).
- **SC-005**: Una consulta sin credenciales al endpoint de salud nunca recibe un rechazo por falta de autenticación, mientras que el 100% de las consultas sin credenciales a los demás endpoints protegidos siguen siendo rechazadas.
- **SC-006**: Ninguna respuesta del endpoint de salud contiene cadenas de conexión, credenciales, variables de configuración ni mensajes de error internos.
- **SC-007**: Quien opera el sistema puede identificar el componente que falla leyendo únicamente la respuesta del endpoint, sin consultar logs.

## Assumptions

- El único componente cuya indisponibilidad impide atender requests de usuario es la base de datos; no hay otras dependencias de infraestructura (cache, cola de mensajes) en el alcance actual.
- El endpoint `GET /health` ya existe en el sistema devolviendo siempre "ok" sin verificar nada; esta feature lo reemplaza por el comportamiento descrito. Los clientes que hoy lo consumen sólo dependen del estado de éxito.
- Los consumidores del endpoint son herramientas de monitoreo y el orquestador de despliegue; no hay interfaz de usuario ni cambios de frontend.
- Un tiempo máximo de espera de unos pocos segundos para la base de datos es razonable para un health check; el valor exacto es un detalle de planificación.
- El endpoint no está sujeto a límites de tasa ni requiere API key: es de lectura, no modifica estado y no expone información sensible.
- Las métricas de latencia/errores y el Correlation ID (también del Principio VII) están fuera del alcance de esta feature.
- La estrategia de pruebas (con base real efímera para el caso sano y simulación de base caída para el caso de error) se define en la planificación, según el Principio IX.
