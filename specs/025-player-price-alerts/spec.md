# Feature Specification: Alertas de precio por estrategia personal

**Feature Branch**: `025-player-price-alerts`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Alertas de precio por estrategia personal — un usuario autenticado puede configurar alertas de precio sobre jugadores puntuales, basadas en su propia cotización personal (la que resulta de su estrategia activa). La alerta se compara contra la cotización del usuario que la creó. Se evalúan cuando se generan cotizaciones nuevas (recálculo manual o scheduler semanal). Cada disparo genera una notificación en bandeja (con push en vivo si está conectado) , a través de un evento de dominio `alert.triggered` consumido por el módulo de notificaciones. _(El envío de email se descartó: ver la nota de actualización.)_"

> **Actualización (2026-10-27):** se eliminó el envío de emails de alertas (historia 4, FR-019 a FR-021 en su parte de email). El aviso queda solo en la bandeja de notificaciones, con push en vivo por SSE. Los módulos de mail, el adaptador de Nodemailer y las variables `MAIL_*` ya no existen; las referencias al email que siguen en este documento son registro histórico de la decisión original.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una alerta de precio sobre un jugador (Priority: P1)

Un usuario autenticado quiere ser avisado cuando la cotización personal de un jugador (según su estrategia activa) suba o baje de un valor que le importa, sin tener que revisar manualmente el valor todos los días.

**Why this priority**: Es la funcionalidad base; sin poder crear una alerta no existe el resto de la feature.

**Independent Test**: Un usuario autenticado puede crear una alerta indicando jugador, condición ("baja de" / "sube de") y umbral, y recibir confirmación de que quedó activa — verificable sin que exista todavía ningún recálculo ni notificación.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado y un jugador existente en el catálogo, **When** crea una alerta con condición "baja de" y un umbral positivo, **Then** la alerta queda creada en estado activa y asociada a ese usuario y jugador.
2. **Given** un usuario autenticado, **When** intenta crear una alerta para un jugador que no existe, **Then** el sistema rechaza la operación con un error de validación.
3. **Given** un usuario autenticado, **When** intenta crear una alerta con un umbral negativo, cero, o no numérico, **Then** el sistema rechaza la operación con un error de validación.
4. **Given** un usuario autenticado, **When** intenta crear una alerta con una condición que no sea "sube de" ni "baja de", **Then** el sistema rechaza la operación con un error de validación.
5. **Given** un usuario con una alerta activa sobre un jugador, **When** crea una segunda alerta sobre el mismo jugador con distinta condición o umbral, **Then** ambas alertas quedan activas simultáneamente.

---

### User Story 2 - Consultar y cancelar las propias alertas (Priority: P1)

El usuario quiere ver qué alertas tiene configuradas y dejar de recibir avisos sobre alguna que ya no le interesa.

**Why this priority**: Sin poder listar y cancelar, el usuario no tiene control sobre las alertas creadas y estas quedarían disparándose indefinidamente sin forma de detenerlas.

**Independent Test**: Un usuario autenticado puede listar sus propias alertas y cancelar una de ellas, quedando excluida de futuras evaluaciones — verificable de forma independiente a si hubo disparos o no.

**Acceptance Scenarios**:

1. **Given** un usuario con varias alertas propias, **When** consulta su listado de alertas, **Then** ve únicamente las alertas que él mismo creó, con su jugador, condición, umbral y estado.
2. **Given** un usuario autenticado, **When** intenta consultar o cancelar una alerta creada por otro usuario, **Then** el sistema rechaza la operación (no la encuentra o no tiene permiso).
3. **Given** un usuario con una alerta activa propia, **When** la cancela, **Then** la alerta pasa a estado cancelada y no vuelve a evaluarse en recálculos futuros.
4. **Given** una alerta que ya se disparó una o más veces, **When** el usuario no la cancela, **Then** la alerta sigue activa y puede volver a dispararse en el siguiente recálculo si la condición se sigue cumpliendo.

---

### User Story 3 - Recibir notificación en bandeja cuando se dispara una alerta (Priority: P1)

El usuario quiere enterarse, dentro de la aplicación, cuando una de sus alertas se cumplió, sin depender de estar conectado en el momento exacto del disparo.

**Why this priority**: Es el canal principal de aviso dentro del producto; sin esto, las alertas creadas no generan ningún valor visible para el usuario.

**Independent Test**: Tras un recálculo que genera una cotización que cumple la condición de una alerta activa, el usuario ve una notificación nueva en su bandeja (leída al conectarse o recargar, aunque no haya estado conectado en el momento del disparo), y puede marcarla como leída.

**Acceptance Scenarios**:

1. **Given** un usuario con una alerta activa con condición "baja de $X", **When** un recálculo genera una cotización personal nueva para ese usuario y jugador con valor menor a $X, **Then** se crea una notificación con el jugador, la condición cumplida, el valor que la disparó y la fecha.
2. **Given** un usuario con notificaciones no leídas, **When** abre la bandeja de notificaciones, **Then** ve las notificaciones ordenadas de más reciente a más antigua, y el contador de no leídas refleja la cantidad correcta.
3. **Given** un usuario con notificaciones no leídas, **When** las marca como leídas, **Then** el contador de no leídas disminuye en consecuencia.
4. **Given** un usuario que no estuvo conectado durante un disparo, **When** se vuelve a conectar o recarga la página, **Then** ve la notificación generada mientras no estaba, igual que cualquier otra.
5. **Given** un usuario conectado en el momento del disparo, **When** se genera la notificación, **Then** la bandeja se actualiza en vivo sin necesidad de recargar la página.
6. **Given** una cotización nueva que no cumple ninguna condición de las alertas activas del usuario para ese jugador, **When** se procesa el recálculo, **Then** no se genera ninguna notificación para ese usuario y jugador.

---

### User Story 4 - ~~Recibir el aviso también por email~~ (Descartada)

Se pensó como canal complementario a la bandeja (aviso por correo electrónico, prioridad P2). Se descartó: la bandeja con push en vivo ya cubre el caso de uso central, y el envío de email agregaba una dependencia externa (servidor SMTP y credenciales) que no se podía probar sin infraestructura real. Se eliminaron el módulo de mail, el adaptador y el listener.

---

### Edge Cases

- Un usuario tiene varias alertas activas sobre el mismo jugador que se cumplen simultáneamente con la misma cotización nueva: cada alerta cumplida genera su propio disparo y su propia notificación independiente.
- El recálculo no genera una `PlayerQuote` nueva para un usuario+jugador (por ejemplo, sin cambios) en ese ciclo: las alertas de ese usuario para ese jugador no se evalúan en ese ciclo.
- Un usuario cambia su estrategia activa o los pesos de su estrategia entre dos recálculos: las alertas existentes no se reevalúan retroactivamente; solo se evaluarán contra la cotización que resulte del próximo recálculo (riesgo aceptado, fuera de alcance).
- Un usuario no está conectado en el momento del disparo: no se reintenta la entrega en vivo por push; la bandeja (al reconectarse) ya cubre ese caso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un usuario autenticado crear una alerta de precio indicando un jugador, una condición ("el precio baja de" o "el precio sube de") y un valor umbral.
- **FR-002**: El sistema MUST validar, al crear una alerta, que el jugador indicado exista, que el umbral sea un número positivo, y que la condición sea una de las dos soportadas; cualquier otro caso MUST ser rechazado con un error de validación.
- **FR-003**: El sistema MUST permitir que un mismo usuario tenga múltiples alertas activas simultáneas sobre el mismo jugador, con condiciones o umbrales distintos, sin restricción de unicidad.
- **FR-004**: Toda alerta creada MUST quedar en estado activa.
- **FR-005**: El sistema MUST permitir a un usuario autenticado consultar únicamente sus propias alertas (no las de otros usuarios).
- **FR-006**: El sistema MUST permitir a un usuario autenticado cancelar únicamente una alerta propia, en cualquier momento.
- **FR-007**: El sistema MUST rechazar cualquier intento de un usuario de consultar o cancelar una alerta que no le pertenece.
- **FR-008**: Una alerta cancelada MUST dejar de evaluarse en recálculos futuros.
- **FR-009**: Una alerta MUST permanecer activa después de dispararse (no se desactiva automáticamente al cumplirse una vez) y MUST volver a evaluarse, y poder volver a dispararse, en recálculos posteriores mientras siga activa.
- **FR-010**: El sistema MUST comparar cada alerta siempre contra la cotización personal del usuario que la creó (resultante de la estrategia activa de ese usuario), nunca contra la cotización de otro usuario ni contra un valor de mercado agregado.
- **FR-011**: El sistema MUST evaluar las alertas activas de un usuario para un jugador únicamente en el momento en que se genera y persiste una `PlayerQuote` nueva para esa combinación usuario+jugador, ya sea por el recálculo manual (`POST /quotes/recalculate`) o por el recálculo semanal del scheduler.
- **FR-012**: Cuando una `PlayerQuote` nueva cumple la condición de una alerta activa, el sistema MUST disparar esa alerta.
- **FR-013**: Cada disparo de alerta MUST generar una notificación propia que incluya el jugador, la condición cumplida, el valor que disparó la condición y la fecha del disparo.
- **FR-014**: El sistema MUST permitir al usuario ver sus notificaciones ordenadas de la más reciente a la más antigua.
- **FR-015**: El sistema MUST mostrar al usuario la cantidad de notificaciones no leídas.
- **FR-016**: El sistema MUST permitir al usuario marcar sus notificaciones como leídas.
- **FR-017**: El sistema MUST conservar y mostrar las notificaciones generadas mientras el usuario no estaba conectado, visibles al reconectarse o recargar.
- **FR-018**: El sistema MUST actualizar la bandeja de notificaciones en vivo cuando el usuario está conectado en el momento del disparo.
- ~~**FR-019**: Cada disparo de alerta MUST enviar un email a la casilla ya registrada en la cuenta del usuario.~~ _Descartado._
- ~~**FR-020**: Una falla en el envío del email MUST NOT afectar a la notificación ya persistida.~~ _Descartado junto con FR-019._
- **FR-021**: Cada disparo de alerta MUST generarse como un evento de dominio (`alert.triggered`) del cual reacciona el proceso que persiste la notificación (bandeja y push en vivo); ni el recálculo ni las alertas MUST conocer directamente al módulo de notificaciones.

### Key Entities

- **PriceAlert**: Representa la intención de un usuario de ser avisado sobre un jugador puntual. Atributos: usuario propietario, jugador, condición (sube de / baja de), valor umbral, estado (activa / cancelada), fecha de creación.
- **AlertNotification**: Representa un aviso generado por un disparo de alerta. Atributos: usuario destinatario, jugador, condición cumplida, valor que disparó la alerta, fecha del disparo, estado de lectura (leída / no leída).
- **PlayerQuote** (existente, referenciada): la cotización personal usuario+jugador generada por un recálculo; dispara la evaluación de alertas cuando se crea una nueva.
- **alert.triggered** (evento de dominio): representa el disparo de una alerta puntual, con la información necesaria para que el consumidor de notificaciones actúe sin que el emisor lo conozca.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede crear una alerta de precio válida en menos de 30 segundos desde la pantalla del jugador.
- **SC-002**: El 100% de los intentos de crear una alerta con jugador inexistente, umbral inválido o condición inválida son rechazados con un mensaje de error comprensible.
- **SC-003**: El 100% de las cotizaciones nuevas que cumplen la condición de una alerta activa generan, dentro del mismo procesamiento del recálculo, una notificación visible para el usuario.
- **SC-004**: Un usuario nunca ve ni puede cancelar una alerta que no le pertenece (0 casos de fuga entre usuarios).
- **SC-005**: Un usuario conectado ve la notificación de un disparo reflejada en la bandeja sin necesidad de recargar la página.
- ~~**SC-006**: Una falla en el envío de un email de alerta nunca provoca la pérdida de la notificación correspondiente.~~ _Descartado junto con el email._

## Assumptions

- El catálogo de jugadores, el sistema de cotizaciones personales por estrategia (`PlayerQuote`), el recálculo manual (`POST /quotes/recalculate`) y el recálculo semanal por scheduler ya existen y están fuera de alcance de esta feature; esta feature se integra con ellos mediante el evento de disparo.
- La conexión de notificaciones push en vivo (para actualizar la bandeja sin recargar) se apoya en un mecanismo de tiempo real ya disponible o estándar para la aplicación (p. ej. WebSocket o SSE); su implementación concreta queda fuera de alcance de esta especificación.
- No existe límite máximo de alertas activas por usuario ni por jugador.
- Cambios de estrategia activa o de pesos del usuario entre recálculos no disparan una reevaluación inmediata de las alertas existentes; solo se reflejan en el próximo recálculo (riesgo aceptado).
- La notificación push en tiempo real no se reintenta si el usuario no está conectado en el instante del disparo; la bandeja persistente ya cubre ese caso.
