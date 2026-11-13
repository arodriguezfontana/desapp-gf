# Feature Specification: Métricas de negocio en /metrics

**Feature Branch**: `031-business-metrics`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Métricas de negocio expuestas en el mismo GET /metrics, para medir cómo se usa y cómo funciona el producto, además de cómo responde la API. Las etiquetas toman valores de conjuntos cerrados y nunca identifican a un usuario, un jugador ni una corrida puntual. Cubre mercado (operaciones, tokens, volumen, rechazos por motivo), sincronización de datos (corridas por fuente, duración, última corrida exitosa), cotización (recálculos y duración), y alertas y notificaciones (disparadas, entregadas en vivo o guardadas, conexiones abiertas). Medir nunca altera el resultado de la operación medida; las métricas se ven en una sección nueva de negocio del dashboard de Grafana. No se agregan endpoints ni SLA nuevos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Medir la actividad del mercado (Priority: P1)

Quien opera el producto consulta las métricas para saber cuánto se está operando: cuántas operaciones de escritura se hicieron por tipo y resultado (exitosa, rechazada por una regla de negocio, fallida de forma inesperada), cuántos tokens y cuántos créditos se movieron en compras y en ventas, y por qué se rechazan las operaciones (saldo insuficiente, tokens insuficientes, tokens no disponibles u otro).

**Why this priority**: El mercado es el núcleo del producto; sin estas cifras no se puede saber si se usa ni por qué fallan las operaciones.

**Independent Test**: Ejecutar una compra exitosa, una compra con saldo insuficiente y una venta con tokens insuficientes, consultar `/metrics` y verificar que cada una quedó contada con su tipo, resultado y motivo, y que tokens y volumen sólo reflejan la exitosa.

**Acceptance Scenarios**:

1. **Given** una operación de escritura que queda registrada, **When** se consultan las métricas, **Then** el conteo de su tipo con resultado exitosa aumenta en uno y los tokens y el volumen en créditos aumentan según corresponda a compra o venta.
2. **Given** una operación rechazada por una regla de negocio, **When** se consultan las métricas, **Then** se cuenta como rechazada con su motivo (saldo insuficiente, tokens insuficientes, tokens no disponibles u otro) y no suma tokens ni volumen.
3. **Given** una operación que falla de forma inesperada o cuyo registro no se concreta, **When** se consultan las métricas, **Then** se cuenta como fallida y nunca como exitosa.
4. **Given** cualquier operación de escritura de la API (no sólo compra y venta), **When** ocurre, **Then** queda contada por su tipo y resultado.

---

### User Story 2 - Saber si los datos externos están al día (Priority: P1)

Quien opera el producto necesita ver, por cada fuente de datos (WhoScored y Football-Data), cuántas sincronizaciones se corrieron según cómo se iniciaron (programada o manual) y cómo terminaron (exitosa si todas las unidades de trabajo terminaron bien, parcial si algunas fallaron y otras no, fallida si se abortó o ninguna terminó bien), cuánto duró cada una y cuándo fue la última exitosa, para detectar datos viejos, incluso tras reiniciar el backend.

**Why this priority**: Datos desactualizados degradan la cotización y la confianza en el producto sin que nadie lo note.

**Independent Test**: Ejecutar una sincronización exitosa, una parcial y una fallida de una fuente, verificar conteos y duración, comprobar que sólo la exitosa mueve el momento de la última exitosa, reiniciar el backend y comprobar que ese momento se conserva.

**Acceptance Scenarios**:

1. **Given** una sincronización de una fuente, **When** termina, **Then** se cuenta por fuente, origen (programada o manual) y resultado, y su duración queda medida.
2. **Given** una sincronización exitosa, **When** se consultan las métricas, **Then** se expone el momento de la última exitosa de esa fuente; una parcial o una fallida no lo modifican.
3. **Given** un reinicio del backend, **When** se consultan las métricas, **Then** el momento de la última exitosa de cada fuente sigue disponible.
4. **Given** una sincronización en la que algunas unidades de trabajo fallaron y otras no, **When** termina, **Then** se cuenta como parcial (no como exitosa ni como fallida) y no avanza el momento de la última exitosa, para que una corrida mayormente fallida no oculte datos desactualizados.
5. **Given** una sincronización que se abortó o en la que ninguna unidad terminó bien, **When** termina, **Then** se cuenta como fallida.

---

### User Story 3 - Seguir los recálculos de cotización (Priority: P2)

Quien opera el producto ve cuántos recálculos de cotización hubo según cómo se iniciaron (programado o manual, incluyendo la simulación de mercado), su resultado y cuánto duran.

**Why this priority**: Permite detectar recálculos que fallan o se vuelven lentos, pero depende menos de la operación diaria que las historias previas.

**Independent Test**: Disparar un recálculo programado y uno manual (y uno por simulación de mercado) y verificar conteo por origen y resultado y la duración medida.

**Acceptance Scenarios**:

1. **Given** un recálculo de cotización, **When** termina, **Then** se cuenta por origen (programado o manual, incluida la simulación de mercado) y resultado, y su duración queda medida.
2. **Given** un recálculo que falla, **When** se consultan las métricas, **Then** figura como fallido y no como exitoso.

---

### User Story 4 - Seguir alertas y notificaciones en tiempo real (Priority: P2)

Quien opera el producto ve cuántas alertas de precio se dispararon, cuántas notificaciones se crearon distinguiendo las entregadas en vivo a un usuario conectado de las que quedaron guardadas por no estar conectado, y cuántas conexiones de notificaciones en tiempo real hay abiertas ahora.

**Why this priority**: Muestra si el canal en vivo se usa y si las alertas cumplen su función.

**Independent Test**: Disparar una alerta con el usuario conectado y otra sin conexión, y verificar los conteos por forma de entrega y que el número de conexiones abiertas sube y baja al conectarse y desconectarse.

**Acceptance Scenarios**:

1. **Given** una alerta de precio que se dispara, **When** se consultan las métricas, **Then** el conteo de alertas disparadas aumenta en uno.
2. **Given** una notificación creada para un usuario conectado, **When** se entrega, **Then** se cuenta como entregada en vivo; si no estaba conectado, se cuenta como guardada.
3. **Given** conexiones de notificaciones abiertas y cerradas, **When** se consulta el valor, **Then** refleja las conexiones abiertas en ese momento, sin quedar desfasado tras desconexiones.

---

### User Story 5 - Ver el negocio en Grafana (Priority: P2)

Quien opera el producto abre el dashboard de Grafana existente y encuentra una sección nueva de negocio con las métricas anteriores, separada de las técnicas de la API.

**Why this priority**: Sin visualización las métricas sólo sirven a quien lee texto crudo.

**Independent Test**: Abrir el dashboard con actividad generada y verificar que la sección de negocio muestra mercado, sincronización, cotización y notificaciones.

**Acceptance Scenarios**:

1. **Given** el dashboard de Grafana, **When** se abre, **Then** existe una sección de negocio con paneles para mercado, sincronización, cotización y alertas/notificaciones.
2. **Given** una sincronización que no corre hace tiempo, **When** se mira la sección, **Then** se ve cuánto hace que fue la última exitosa de cada fuente.

---

### Edge Cases

- Una operación que falla después de decidirse pero antes de registrarse no debe figurar como exitosa.
- Una operación reintentada cuenta cada intento por su resultado real; una exitosa nunca se duplica.
- Si la medición misma falla, la operación medida conserva su resultado y su respuesta sin cambios.
- Motivos de rechazo no previstos se agrupan bajo "otro"; nunca generan valores de etiqueta nuevos.
- Sin actividad todavía, `/metrics` y el dashboard siguen funcionando (series en cero o ausentes).
- Una fuente que nunca tuvo una corrida exitosa no expone un momento falso, aunque haya tenido corridas parciales.
- Una misma operación de recálculo nunca se cuenta dos veces, aunque la inicie la simulación de mercado.
- Tras un reinicio del backend los contadores vuelven a cero, salvo la última sincronización exitosa.
- Un cierre abrupto de una conexión en vivo no debe dejar inflada la cuenta de conexiones abiertas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Las métricas de negocio MUST exponerse en el mismo `GET /metrics` existente, sin endpoints nuevos y sin autenticación adicional respecto de lo ya vigente.
- **FR-002**: Todas las etiquetas MUST tomar valores de conjuntos cerrados y fijos, y NEVER identificar a un usuario, un jugador ni una corrida puntual.
- **FR-003**: El sistema MUST contar las operaciones de escritura de la API por tipo y resultado (exitosa, rechazada por regla de negocio, fallida de forma inesperada).
- **FR-004**: El sistema MUST contar los tokens operados y el volumen en créditos, separados por compra y venta.
- **FR-005**: El sistema MUST contar las operaciones rechazadas por motivo: saldo insuficiente, tokens insuficientes, tokens no disponibles u otro.
- **FR-006**: Una operación MUST contarse como exitosa, y sumar tokens y volumen, únicamente si quedó efectivamente registrada.
- **FR-007**: El sistema MUST contar las corridas de sincronización por fuente (WhoScored, Football-Data), origen (programada, manual) y resultado (exitosa, parcial, fallida), y medir su duración. Exitosa: todas las unidades de trabajo terminaron bien. Fallida: se abortó o ninguna unidad terminó bien. Parcial: cualquier otro caso (algunas unidades fallaron y otras no).
- **FR-008**: El sistema MUST exponer el momento de la última sincronización exitosa de cada fuente, conservado tras reiniciar el backend; una corrida parcial o fallida MUST NOT modificarlo.
- **FR-009**: El sistema MUST contar los recálculos de cotización por origen (programado, manual, incluida la simulación de mercado) y resultado, y medir su duración.
- **FR-010**: El sistema MUST contar las alertas de precio disparadas.
- **FR-011**: El sistema MUST contar las notificaciones creadas distinguiendo las entregadas en vivo de las guardadas por no estar el usuario conectado.
- **FR-012**: El sistema MUST exponer la cantidad de conexiones de notificaciones en tiempo real abiertas en el momento de la consulta.
- **FR-013**: Medir MUST NEVER alterar el resultado ni la respuesta de la operación medida; un fallo al medir no puede propagarse.
- **FR-014**: El dashboard de Grafana MUST incluir una sección nueva de negocio que muestre las métricas anteriores, separada de las técnicas.
- **FR-015**: Las métricas de negocio MUST mantenerse separadas de las métricas de la API, y MUST NOT introducirse SLA nuevos.
- **FR-016**: La decisión de diseño (medir el negocio por separado de la API y contar sólo lo que realmente ocurrió) y el riesgo aceptado MUST quedar documentados junto a la documentación de monitoreo.

### Key Entities

- **Operación de mercado**: acción de escritura de la API; atributos: tipo, resultado, motivo de rechazo (si aplica), lado (compra/venta), tokens y créditos.
- **Corrida de sincronización**: ejecución para una fuente; atributos: fuente, origen, resultado, duración, momento de la última exitosa.
- **Recálculo de cotización**: ejecución; atributos: origen, resultado, duración.
- **Alerta / notificación**: alerta disparada y notificación creada; atributo: forma de entrega (en vivo o guardada).
- **Conexión en vivo**: canal abierto de notificaciones en tiempo real; sólo se expone su cantidad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras ejecutar un conjunto conocido de operaciones (exitosas, rechazadas por cada motivo y fallidas), los conteos expuestos coinciden exactamente con lo ocurrido, sin ninguna rechazada o fallida contada como exitosa.
- **SC-002**: Quien opera puede determinar en menos de 1 minuto, desde el dashboard, si cada fuente de datos tiene una sincronización exitosa reciente.
- **SC-003**: El momento de la última sincronización exitosa de cada fuente sobrevive a un reinicio del backend en el 100% de las pruebas.
- **SC-004**: El 100% de las series de negocio usa valores de etiqueta de conjuntos cerrados; ninguna contiene identificadores de usuario, jugador o corrida.
- **SC-005**: Forzar un fallo en la medición no cambia el resultado ni la respuesta de ninguna operación medida.
- **SC-006**: El dashboard muestra la sección de negocio con las cuatro áreas (mercado, sincronización, cotización, alertas/notificaciones) sin configuración manual adicional.
- **SC-007**: La cuenta de conexiones abiertas vuelve a cero cuando todas las conexiones se cierran, incluidos cierres abruptos.

## Assumptions

- Se reutilizan el endpoint `GET /metrics` y el dashboard de Grafana de la spec 029; no se crean endpoints ni SLA.
- "Operaciones de escritura" abarca todas las operaciones de escritura de la API (compra, venta, órdenes, cancelaciones, alertas, etc.), cada una con su tipo.
- La última sincronización exitosa se conserva en almacenamiento persistente (una tabla mínima nueva; ver plan). Sólo una corrida exitosa la actualiza.
- Los recálculos de cotización se miden con dos resultados (exitoso, fallido); el resultado parcial aplica únicamente a la sincronización.
- Una operación de escritura `exitosa` significa que la operación fue aceptada; para las que disparan un proceso largo en segundo plano (p. ej. sincronización de WhoScored) no significa que el proceso haya terminado, cuyo resultado se mide aparte.
- Las demás métricas viven en memoria y se reinician con el backend.
- **Decisión de diseño**: el negocio se mide por separado de la API, y sólo se cuenta lo que realmente ocurrió, para que una operación no concretada nunca figure como exitosa.
- **Riesgo aceptado, fuera de alcance**: las métricas se reinician con el backend (salvo la última sincronización exitosa); con varias instancias cada una expone las suyas; no hay alertas sobre estos valores.
