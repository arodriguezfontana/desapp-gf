# Feature Specification: Consulta de Cotización de Jugador (GET /players/:id/quote)

**Feature Branch**: `013-player-quote-endpoint`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "La feature agrega GET /players/:id/quote con un parámetro de query opcional at (fecha ISO 8601, ej. 2026-09-15). Cuando at está presente, el endpoint retorna el PlayerQuote cuyo calculatedAt es el más reciente entre todos los que son menores o iguales al final del día solicitado (medianoche UTC). Cuando at está ausente, retorna el quote más reciente sin restricción de fecha. Si el jugador no existe: 404 con código PLAYER_NOT_FOUND. Si el jugador existe pero no hay ningún quote que satisfaga la condición: 204 No Content. Si at tiene un formato inválido que no parsea como fecha: 400. La respuesta incluye playerId, valor (DECIMAL 10,2), score (DECIMAL 8,6), strategyName, weights (snapshot de los pesos al momento del cálculo, igual que se persiste en player_quotes), y calculatedAt como ISO timestamp. El acceso requiere ApiKey, igual que GET /players. Decisión de diseño a documentar: se eligió semántica “vigente ese día” (calculatedAt ≤ fecha) por sobre “más cercano al día” porque es determinista y refleja lo que el mercado habría visto en esa fecha — un quote calculado el martes sigue vigente el miércoles si no hubo recálculo. El resultado vacío es 204 y no 404 porque la ausencia de quote para una fecha es un estado válido, no un error."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar cotización vigente más reciente de un jugador (Priority: P1)

Un consumidor de la API (por ejemplo el frontend o un servicio consumidor de datos) desea obtener la cotización vigente y más reciente de un jugador de fútbol registrado en el catálogo para visualizar su valor actual de mercado, score normalizado y detalles de la estrategia que determinó dicho precio.

**Why this priority**: Es la funcionalidad principal del endpoint. Permite consultar el precio actual del jugador en tiempo presente sin necesidad de especificar filtros temporales.

**Independent Test**: Puede testearse de forma aislada realizando una petición `GET /players/:id/quote` con una ApiKey válida para un jugador que posea cotizaciones calculadas, verificando que se devuelve un status HTTP 200 con la última cotización y todos sus campos de auditoría y ponderación.

**Acceptance Scenarios**:

1. **Given** un jugador existente en el sistema que tiene al menos una cotización registrada, **When** se envía una petición `GET /players/:id/quote` sin el parámetro `at` y con una ApiKey válida, **Then** el sistema responde con HTTP 200 y el objeto de cotización con el `calculatedAt` más reciente, conteniendo `playerId`, `valor`, `score`, `strategyName`, `weights` y `calculatedAt`.
2. **Given** un jugador existente en el sistema que no tiene ninguna cotización calculada en su historial, **When** se envía una petición `GET /players/:id/quote` con una ApiKey válida, **Then** el sistema responde con HTTP 204 No Content sin cuerpo.
3. **Given** un identificador de jugador que no existe en el catálogo, **When** se envía una petición `GET /players/:id/quote` con una ApiKey válida, **Then** el sistema responde con HTTP 404 Not Found y mensaje/código de error `PLAYER_NOT_FOUND`.
4. **Given** una petición a `GET /players/:id/quote` sin header de ApiKey o con una ApiKey inválida, **When** se realiza la llamada, **Then** el sistema responde con HTTP 401 Unauthorized sin procesar la consulta.

---

### User Story 2 - Consultar cotización histórica vigente en una fecha dada (Priority: P2)

Un consumidor de la API desea consultar la cotización que estaba vigente para un jugador en una fecha histórica específica (por ejemplo para auditar precios en una fecha de transacción, calcular el rendimiento de una cartera o renderizar gráficos históricos).

**Why this priority**: Permite reconstrucción histórica y auditoría temporal de precios de mercado con criterio determinista.

**Independent Test**: Puede testearse de forma aislada cargando cotizaciones calculadas en diferentes fechas para un jugador y realizando peticiones con `at=YYYY-MM-DD`, verificando que se selecciona exactamente la cotización más reciente que cumple `calculatedAt <=` final del día UTC especificado.

**Acceptance Scenarios**:

1. **Given** un jugador con múltiples cotizaciones (por ejemplo calculadas el 2026-09-10 y el 2026-09-20), **When** se consulta `GET /players/:id/quote?at=2026-09-15` con ApiKey válida, **Then** el sistema retorna la cotización calculada el 2026-09-10 (la más reciente menor o igual al final del día 2026-09-15T23:59:59.999Z) con status HTTP 200.
2. **Given** un jugador cuya cotización fue calculada el martes y el miércoles no hubo recálculo, **When** se consulta `GET /players/:id/quote?at=[fecha_del_miércoles]`, **Then** el sistema retorna la cotización del martes como vigente en esa fecha con status HTTP 200.
3. **Given** un jugador cuya primera cotización histórica fue calculada el 2026-09-15, **When** se consulta `GET /players/:id/quote?at=2026-09-14` (fecha previa a cualquier cotización del jugador), **Then** el sistema retorna HTTP 204 No Content sin cuerpo.
4. **Given** una petición con el parámetro `at` conteniendo una cadena que no parsea como fecha válida (por ejemplo `at=invalido` o `at=2026-02-31`), **When** se realiza la consulta, **Then** el sistema retorna HTTP 400 Bad Request indicando que el parámetro `at` no es una fecha válida.

---

### Edge Cases

- **Múltiples cotizaciones en el mismo día**: Si un jugador tiene más de un recálculo en la misma fecha indicada en `at`, el endpoint debe retornar el recálculo con el timestamp `calculatedAt` más alto dentro de ese día (hasta 23:59:59.999 UTC).
- **Formato del parámetro `at`**: Si `at` se provee como fecha corta `YYYY-MM-DD` (ej. `2026-09-15`) o con timestamp ISO 8601 (ej. `2026-09-15T10:00:00Z`), el límite de corte considerado es el final del día correspondiente en UTC (23:59:59.999 UTC de ese día calendario).
- **Consultas con fechas futuras**: Si `at` apunta a una fecha futura respecto al momento de consulta, el sistema retorna la última cotización registrada hasta la fecha actual (o 204 No Content si el jugador nunca tuvo cotizaciones).
- **Identificador de jugador malformado**: Si el parámetro de ruta `:id` no cumple el formato esperado (UUID v4), el sistema retorna HTTP 400 Bad Request o HTTP 404 `PLAYER_NOT_FOUND` a través de los mecanismos de validación de rutas y exceptions filter.
- **Estrategias inactivas o históricas**: La respuesta debe reflejar el `strategyName` y el `weights` (snapshot) correspondientes a la estrategia con la que se calculó esa cotización específica en su momento, sin importar qué estrategia esté activa actualmente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer el endpoint `GET /players/:id/quote` protegido con `ApiKeyGuard` (requiere cabecera de ApiKey válida; exento de JWT mediante `@Public()`, coherente con los endpoints de jugadores según Constitución Principio IV).
- **FR-002**: El endpoint MUST aceptar un parámetro de query opcional `at` que represente una fecha en formato ISO 8601 (por ejemplo `2026-09-15`).
- **FR-003**: Si el parámetro `at` está presente:
  - El sistema MUST validar que el valor corresponda a una fecha parseable y válida. Si no es válido, MUST responder con HTTP 400 Bad Request.
  - El sistema MUST calcular el límite temporal como el final del día UTC de la fecha indicada (23:59:59.999 UTC / medianoche UTC).
  - El sistema MUST buscar la cotización del jugador identificado por `:id` cuyo `calculatedAt` sea el más reciente entre todas aquellas con `calculatedAt <= final_del_dia_UTC`.
- **FR-004**: Si el parámetro `at` está ausente:
  - El sistema MUST buscar la cotización del jugador identificado por `:id` con el `calculatedAt` más reciente de todo el historial sin restricción temporal.
- **FR-005**: Si el jugador con el `:id` especificado no existe en la base de datos de jugadores:
  - El sistema MUST responder con código HTTP 404 Not Found y el código/mensaje de error `PLAYER_NOT_FOUND`.
- **FR-006**: Si el jugador existe pero no se encuentra ninguna cotización que cumpla con el criterio temporal (sea actual o con `at` histórico):
  - El sistema MUST responder con código HTTP 204 No Content con cuerpo vacío.
- **FR-007**: Cuando se encuentra una cotización válida, el sistema MUST responder con HTTP 200 y una estructura JSON conteniendo:
  - `playerId`: Identificador único del jugador (UUID).
  - `valor`: Valor del token en créditos, formateado como decimal con 2 dígitos decimales (DECIMAL 10,2).
  - `score`: Score normalizado obtenido de las métricas, formateado como decimal con 6 dígitos decimales (DECIMAL 8,6).
  - `strategyName`: Nombre de la estrategia de valuación utilizada en el cálculo.
  - `weights`: Objeto clave-valor (snapshot) con los pesos aplicados a cada métrica en ese cálculo.
  - `calculatedAt`: Timestamp en formato ISO 8601 (UTC) en el que se efectuó el cálculo.
- **FR-008**: Todas las respuestas de error MUST canalizarse a través del filtro global `AllExceptionsFilter`, garantizando que no se filtren stack traces ni información interna (Constitución Principio III).
- **FR-009**: El endpoint MUST documentarse en OpenAPI v3 mediante decoradores de `@nestjs/swagger` indicando los status codes 200, 204, 400, 401 y 404 (Constitución Principio VIII).
- **FR-010**: La colección Postman del proyecto MUST actualizarse incorporando la consulta del nuevo endpoint con ejemplos de uso con y sin el parámetro `at` (Constitución Principio X).

### Key Entities

- **Player**: Representa al futbolista del catálogo (id, name, etc.). El endpoint valida su existencia previa antes de evaluar sus cotizaciones.
- **PlayerQuote**: Representa la cotización calculada en un momento dado. Atributos clave: `id`, `playerId`, `strategyId`, `weightSnapshot`, `factorEscalaSnapshot`, `score`, `value`, `calculatedAt`.
- **ValuationStrategy**: Representa la estrategia de cálculo configurada. Atributos clave: `id`, `name`, `weights`, `factorEscala`, `isActive`. Provee el `name` asociado a la cotización si este no estuviera duplicado en la cotización.

## Design Decisions

- **DD-001: Semántica "vigente ese día" vs "más cercano al día"**:
  Se eligió la semántica “vigente ese día” (`calculatedAt <= final del día UTC`) en lugar de buscar la cotización temporalmente más próxima al día. Justificación: es una regla determinista y reproduce con exactitud lo que el mercado o los participantes habrían observado en esa fecha en tiempo real. Por ejemplo, una cotización calculada el martes continúa vigente el miércoles si durante el miércoles no se ejecutó un nuevo recálculo masivo.
- **DD-002: Código de respuesta HTTP 204 No Content ante ausencia de cotización**:
  Se utiliza HTTP 204 No Content en lugar de HTTP 404 Not Found cuando un jugador registrado no posee cotizaciones (o no posee cotizaciones anteriores a la fecha requerida). Justificación: que un jugador no tenga cotización en una fecha histórica o no haya sido aún cotizado es un estado de negocio válido y esperado (por ejemplo, antes de su primera sincronización o fecha de cálculo), no un recurso web inexistente. El código 404 se reserva estrictamente para cuando el jugador no existe (`PLAYER_NOT_FOUND`).
- **DD-003: Autenticación por ApiKeyGuard**:
  El endpoint se ubica en el recurso de jugadores (`GET /players/:id/quote`) y utiliza `ApiKeyGuard` junto con `@Public()`, manteniéndose simétrico a `GET /players` y `GET /players/:id` de acuerdo con la Constitución (Principio IV).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las consultas de cotización (con o sin parámetro `at`) se resuelven en menos de 100 ms en el 95% de las llamadas en ambiente de prueba.
- **SC-002**: 100% de reproducibilidad y determinismo: peticiones idénticas con el mismo parámetro `at` sobre un historial idéntico devuelven exactamente la misma cotización y valores.
- **SC-003**: 100% de cobertura de escenarios de prueba (tests unitarios, de integración y end-to-end con Testcontainers) para casos exitosos (200), ausencia de cotización (204), fecha inválida (400), jugador inexistente (404) y autenticación rechazada (401).

## Assumptions

- El parámetro de fecha `at` se interpreta con referencia horaria UTC; cuando se provee únicamente una fecha (ej. `2026-09-15`), el límite de corte se establece a las `23:59:59.999Z` de ese día en UTC.
- Si un jugador posee múltiples cotizaciones en el mismo día, la más reciente (mayor timestamp en `calculatedAt`) es la que se considera vigente al cierre de ese día.
- El nombre de la estrategia (`strategyName`) puede resolverse a través de la entidad `ValuationStrategy` asociada mediante `strategyId`.
- No se requiere paginación ni lista histórica de múltiples cotizaciones en este endpoint puntual, ya que su propósito es devolver una única cotización puntual/vigente.

