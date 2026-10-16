# Feature Specification: Estrategias de Valuación Propias por Usuario

**Feature Branch**: `019-per-user-valuation-strategies`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Esta feature reemplaza el modelo de estrategias administradas por el admin: no existe una estrategia del sistema aparte, las estrategias de valuación son exclusivamente del usuario común. Al registrarse, cada usuario recibe automáticamente las dos estrategias ya definidas ('Performance general' e 'Impacto táctico', con los mismos valores de pesos que ya estaban especificados), como copias propias editables — no comparte estos registros con otros usuarios, son su punto de partida. Una de las dos queda seleccionada por default. El usuario siempre tiene exactamente esas dos, no puede crear otras ni eliminarlas. GET /users/me/strategies lista las dos estrategias del usuario, indicando cuál está seleccionada. PATCH /users/me/strategies/:id/select marca una de las dos como la seleccionada. PATCH /users/me/strategies/:id/weights y PATCH /users/me/strategies/:id/position-weights/:position editan los pesos de cualquiera de sus dos estrategias, siempre validando que la suma de pesos dé 1.0 ±0.001. Solo el dueño puede operar sobre sus propias estrategias (403 si no). GET /players/:id/valuation calcula cuánto valdría ese jugador según la estrategia seleccionada del usuario que consulta (o según una estrategia puntual pasada por query). POST /users/me/quotes/recalculate recalcula y persiste una nueva cotización para los jugadores (todos, o uno puntual), usando la estrategia seleccionada del usuario en ese momento; a diferencia de GET /players/:id/valuation, este sí genera un registro inmutable que pasa a formar parte del historial de ese usuario para ese jugador. Es un job manual, no corre solo. El historial de cotizaciones, que antes era único por jugador para todo el sistema, pasa a ser por usuario. GET /players/:id/quotes (JWT) devuelve el historial de cotizaciones de ese jugador generadas por el usuario que consulta, nunca las de otro usuario, ordenadas cronológicamente. Si el usuario todavía no disparó ningún recálculo para ese jugador, el historial viene vacío."

## Clarifications

### Session 2026-10-14

- Q: When a user already has a recalculation running for themselves and triggers POST /users/me/quotes/recalculate again before it finishes, how should the system respond? → A: Reject the second request with a conflict (409-style) response, scoped per user — a user can't have two recalculations in flight at once, but different users never block each other.
- Q: When POST /users/me/quotes/recalculate is triggered for the whole catalog (no player id), should the request block until every player is recalculated, or return immediately and process in the background? → A: Synchronous — the request blocks and returns only once all players (or the single player) are recalculated.
- Q: If a bulk recalculation (no specific player) fails to compute a value for one player partway through (e.g. missing metrics data), should the whole operation abort with nothing persisted, or skip that player and keep persisting quotes for the rest? → A: Skip and continue — players that fail are skipped; all other players still get a new persisted quote.
- Q: Should GET /players/:id/quotes support pagination? → A: No pagination for now — it returns the full chronological list every time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibir las dos estrategias propias al registrarse (Priority: P1)

Al crear su cuenta, un usuario recibe automáticamente dos estrategias de valuación propias ("Performance general" e "Impacto táctico"), con los mismos pesos ya definidos como punto de partida del sistema, sin que el usuario tenga que hacer nada para que existan. Una de las dos queda marcada como seleccionada por defecto.

**Why this priority**: Es la base de toda la feature: sin este aprovisionamiento automático, ningún usuario podría consultar valuaciones, editar pesos ni disparar recálculos, porque no existiría ninguna estrategia propia sobre la cual operar.

**Independent Test**: Se puede testear de forma aislada creando una cuenta nueva y verificando, inmediatamente después del alta, que el usuario tiene exactamente dos estrategias propias con los pesos esperados y que una de ellas está marcada como seleccionada, sin ninguna acción adicional.

**Acceptance Scenarios**:

1. **Given** una persona que completa el alta de cuenta, **When** la cuenta queda creada, **Then** el usuario tiene asociadas exactamente dos estrategias propias ("Performance general" e "Impacto táctico") con los mismos pesos generales (y perfiles de posición, si la estrategia los define) ya especificados como seed del sistema.
2. **Given** las dos estrategias recién creadas para ese usuario, **When** se inspeccionan, **Then** exactamente una de las dos figura como seleccionada por defecto y ninguna otra estrategia de ningún otro usuario se ve afectada.
3. **Given** dos usuarios distintos que se registran por separado, **When** se comparan sus estrategias, **Then** cada uno tiene su propio par de registros independientes, sin compartir identificadores ni verse afectado un usuario por cambios en las estrategias del otro.

---

### User Story 2 - Listar y seleccionar cuál de mis dos estrategias usar (Priority: P1)

Un usuario autenticado puede ver sus dos estrategias propias, identificar cuál está seleccionada actualmente, y cambiar la selección a la otra cuando quiera que sus próximas valuaciones y recálculos usen un criterio distinto.

**Why this priority**: Es la capacidad central que distingue a este modelo: el usuario decide con cuál de sus dos estrategias opera el resto del sistema en su nombre. Sin esto, tener dos estrategias propias no tendría ningún efecto práctico.

**Independent Test**: Se puede testear de forma aislada listando las estrategias de un usuario recién registrado, seleccionando la que no estaba seleccionada, y verificando que la selección cambió y que la otra quedó marcada como no seleccionada.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con sus dos estrategias propias, **When** consulta la lista de sus estrategias, **Then** recibe las dos, cada una indicando si está o no seleccionada, y exactamente una aparece como seleccionada.
2. **Given** la estrategia "Impacto táctico" no seleccionada, **When** el usuario la marca como seleccionada, **Then** esa estrategia pasa a estar seleccionada y "Performance general" pasa a no estarlo, sin afectar los pesos de ninguna de las dos.
3. **Given** una estrategia que ya está seleccionada, **When** el usuario repite la selección sobre esa misma estrategia, **Then** el estado no cambia y sigue habiendo exactamente una estrategia seleccionada.
4. **Given** un identificador de estrategia que no corresponde a ninguna de las dos estrategias del usuario autenticado (porque no existe o porque pertenece a otro usuario), **When** se intenta seleccionarla, **Then** la operación se rechaza y la selección vigente no cambia.

---

### User Story 3 - Editar los pesos de mis propias estrategias (Priority: P2)

Un usuario autenticado puede ajustar los pesos generales de cualquiera de sus dos estrategias, y también los pesos del perfil de una posición específica dentro de esa estrategia, para adaptar el criterio de valuación a lo que él considera importante, siempre que la suma de los pesos se mantenga válida.

**Why this priority**: Es lo que hace que la estrategia sea realmente "propia" del usuario más allá de ser una copia fija; depende de que las estrategias ya existan (Historia 1) pero no bloquea la capacidad básica de listar/seleccionar/valuar (Historias 1, 2 y 4), por lo que puede entregarse después de esas.

**Independent Test**: Se puede testear de forma aislada editando los pesos generales de una de las dos estrategias de un usuario con valores que suman 1.0 y verificando que se guardan; y por separado, intentando guardar pesos que no sumen 1.0 (±0.001) y verificando que la operación se rechaza sin modificar la estrategia.

**Acceptance Scenarios**:

1. **Given** una de las dos estrategias propias del usuario autenticado, **When** edita sus pesos generales con un conjunto de valores cuya suma algebraica da 1.0 (±0.001), **Then** la estrategia queda actualizada con los nuevos pesos.
2. **Given** la misma estrategia, **When** edita el perfil de pesos de una posición (FW, MF, DF o GK) con valores cuya suma da 1.0 (±0.001), **Then** ese perfil de posición queda actualizado sin afectar los pesos generales ni el perfil de las demás posiciones.
3. **Given** cualquiera de las dos estrategias, **When** el usuario intenta guardar pesos (generales o de un perfil de posición) cuya suma queda fuera de 1.0 ±0.001, **Then** el sistema rechaza la operación, no persiste ningún cambio parcial, y la estrategia conserva sus pesos previos.
4. **Given** una estrategia que no está seleccionada en este momento, **When** el usuario edita sus pesos, **Then** la edición se aplica igual que si estuviera seleccionada, sin requerir seleccionarla primero.
5. **Given** una estrategia que pertenece a otro usuario, **When** el usuario autenticado intenta editar sus pesos generales o el perfil de alguna posición, **Then** el sistema rechaza la operación informando que no tiene permiso, y no modifica la estrategia ajena.

---

### User Story 4 - Consultar cuánto valdría un jugador según mi estrategia (Priority: P1)

Un usuario autenticado puede consultar, en cualquier momento y sin generar ningún registro permanente, cuánto valdría un jugador puntual aplicando la estrategia que tiene seleccionada, o bien aplicando la otra de sus dos estrategias si así lo indica explícitamente en la consulta.

**Why this priority**: Es el núcleo funcional heredado de la valuación de jugadores, ahora resuelto en términos de la estrategia del usuario que consulta en lugar de una estrategia única de sistema; sin esto, tener estrategias propias no serviría para nada.

**Independent Test**: Se puede testear de forma aislada consultando la valuación de un jugador con dos usuarios distintos que tienen seleccionadas estrategias distintas, y verificando que cada uno obtiene un valor calculado según su propia estrategia seleccionada, sin que la consulta deje ningún rastro persistido.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con una estrategia seleccionada y un jugador existente, **When** consulta la valuación de ese jugador, **Then** recibe el valor calculado aplicando los pesos (generales o, si corresponde, el perfil de la posición del jugador) de la estrategia seleccionada de ese usuario.
2. **Given** el mismo jugador, **When** dos usuarios distintos con estrategias seleccionadas distintas consultan su valuación, **Then** cada uno recibe un valor calculado según su propia estrategia, pudiendo diferir entre sí.
3. **Given** un usuario autenticado, **When** consulta la valuación indicando por query cuál de sus dos estrategias usar (que no es la seleccionada), **Then** el valor se calcula con esa estrategia puntual, sin cambiar cuál queda marcada como seleccionada.
4. **Given** una consulta de valuación, **When** se compara el historial de cotizaciones del jugador antes y después de la consulta, **Then** no aparece ningún registro nuevo: la consulta no persiste nada.
5. **Given** un identificador de jugador que no existe en el catálogo, **When** se consulta su valuación, **Then** el sistema responde que el jugador no existe, sin calcular ningún valor.

---

### User Story 5 - Disparar manualmente el recálculo de mis cotizaciones (Priority: P2)

Un usuario autenticado puede pedir que el sistema recalcule y deje registrada, de forma inmutable, una nueva cotización para todos los jugadores del catálogo (o para uno puntual), usando la estrategia que tiene seleccionada en ese momento, para actualizar su propio historial de valor con las métricas más recientes.

**Why this priority**: Es lo que efectivamente alimenta el historial por usuario (Historia 6); depende de que existan estrategias propias y selección (Historias 1 y 2), pero no bloquea la consulta exploratoria de valuación (Historia 4).

**Independent Test**: Se puede testear de forma aislada disparando el recálculo para un jugador puntual y verificando que queda una nueva entrada inmutable en el historial propio de ese usuario para ese jugador, con el valor y la estrategia usados en ese momento.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con una estrategia seleccionada, **When** dispara el recálculo sin indicar un jugador puntual, **Then** el sistema calcula y persiste una nueva cotización para cada jugador del catálogo, asociada a ese usuario y a la estrategia usada.
2. **Given** el mismo usuario, **When** dispara el recálculo indicando un jugador puntual, **Then** el sistema calcula y persiste una nueva cotización únicamente para ese jugador, sin afectar al resto del catálogo.
3. **Given** un recálculo recién disparado, **When** se inspecciona el registro generado, **Then** queda asociado de forma inmutable al usuario que lo disparó y a la estrategia (incluyendo, si corresponde, el perfil de posición) usada en ese cálculo.
4. **Given** que nadie disparó ningún recálculo, **When** pasa el tiempo, **Then** no se genera ninguna cotización nueva para ningún usuario: el recálculo nunca se ejecuta de forma automática o programada.
5. **Given** un jugador puntual indicado que no existe en el catálogo, **When** se dispara el recálculo con ese identificador, **Then** el sistema rechaza la operación informando que el jugador no existe, sin persistir ninguna cotización.
6. **Given** un recálculo de ese mismo usuario ya en curso, **When** ese usuario dispara otro recálculo antes de que el primero termine, **Then** el sistema rechaza el segundo con una respuesta de conflicto, sin iniciar un segundo proceso en paralelo para ese usuario.
7. **Given** un recálculo en curso para un usuario, **When** otro usuario distinto dispara su propio recálculo al mismo tiempo, **Then** ambos recálculos se ejecutan sin interferirse, porque el bloqueo de concurrencia es por usuario, no global.

---

### User Story 6 - Consultar mi propio historial de valor de un jugador (Priority: P2)

Un usuario autenticado puede consultar, para un jugador puntual, la lista de todas las cotizaciones que él mismo generó con sus propios recálculos a lo largo del tiempo, ordenadas de la más antigua a la más reciente, para ver cómo evolucionó el valor de ese jugador según su propio criterio.

**Why this priority**: Es la forma en que el usuario consume el efecto acumulado de sus recálculos (Historia 5); depende de que existan cotizaciones propias para tener algo que mostrar, pero puede entregarse en el mismo incremento que la capacidad de recalcular.

**Independent Test**: Se puede testear de forma aislada disparando dos recálculos sucesivos para el mismo jugador con el mismo usuario y verificando que su historial trae ambas entradas en orden cronológico; y, por separado, consultando el historial de un jugador para un usuario que nunca recalculó y verificando que el historial viene vacío.

**Acceptance Scenarios**:

1. **Given** un usuario que disparó varios recálculos para un mismo jugador en momentos distintos, **When** consulta el historial de ese jugador, **Then** recibe únicamente las cotizaciones que él mismo generó, ordenadas de la más antigua a la más reciente, cada una con su valor calculado y la fecha en que se generó.
2. **Given** dos usuarios distintos que recalcularon el mismo jugador, **When** cada uno consulta el historial de ese jugador, **Then** cada uno ve únicamente las entradas que él mismo generó, nunca las del otro usuario.
3. **Given** un usuario autenticado que todavía no disparó ningún recálculo para un jugador puntual, **When** consulta el historial de ese jugador, **Then** recibe una respuesta exitosa con una lista vacía, sin que el sistema infiera ni muestre ningún valor de partida automático.
4. **Given** un identificador de jugador que no existe en el catálogo, **When** se consulta su historial, **Then** el sistema responde que el jugador no existe.

---

### Edge Cases

- ¿Qué sucede si se intenta seleccionar, editar pesos generales o editar un perfil de posición de un identificador de estrategia que no existe? → El sistema rechaza la operación informando que la estrategia no existe.
- ¿Qué sucede si un usuario conoce (o adivina) el identificador de una estrategia de otro usuario e intenta operar sobre ella (seleccionarla, editar sus pesos)? → El sistema rechaza la operación con una respuesta de acceso prohibido, sin aplicar ningún cambio ni revelar más datos de la estrategia ajena que los estrictamente necesarios para el rechazo.
- ¿Qué sucede si se edita el perfil de posición de una estrategia con una posición que no es ninguna de las cuatro reconocidas (FW, MF, DF, GK)? → El sistema rechaza la operación por posición inválida.
- ¿Qué sucede si se indica en GET /players/:id/valuation una estrategia puntual por query que no pertenece al usuario autenticado? → El sistema rechaza la consulta, de la misma forma que rechaza operar sobre una estrategia ajena en los endpoints de edición.
- ¿Qué sucede si dos usuarios disparan un recálculo masivo del catálogo en paralelo? → Cada recálculo persiste sus propias cotizaciones asociadas a su propio usuario y a su propia estrategia seleccionada en ese momento; los recálculos de distintos usuarios no interfieren entre sí ni comparten registros.
- ¿Qué sucede si el mismo usuario dispara varios recálculos seguidos para el mismo jugador? → Cada invocación agrega una nueva entrada al historial de ese usuario para ese jugador, sin sobrescribir ni eliminar las anteriores.
- ¿Qué sucede si, durante un recálculo de todo el catálogo, falla el cálculo de un jugador puntual (por ejemplo, por falta de datos de métricas)? → El sistema omite únicamente ese jugador y continúa persistiendo la cotización del resto del catálogo; la operación no se aborta por completo.
- ¿La invocación a POST /users/me/quotes/recalculate responde antes o después de terminar el cálculo? → Responde únicamente después de terminar: es una operación síncrona, no dispara un proceso en segundo plano que continúe tras la respuesta.
- ¿Qué sucede con la estrategia de sistema única y el rol administrativo que antes activaba una estrategia para todos? → Dejan de existir como tales: no hay ninguna estrategia que no pertenezca a un usuario, y ninguna operación administrativa de activación de estrategia permanece disponible tras esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al registrarse un nuevo usuario, el sistema MUST crearle automáticamente dos estrategias de valuación propias, "Performance general" e "Impacto táctico", con los mismos pesos generales (y perfiles de posición, cuando la estrategia los define) ya especificados como punto de partida del sistema, como copias independientes no compartidas con ningún otro usuario.
- **FR-002**: El sistema MUST marcar exactamente una de las dos estrategias recién creadas de cada usuario como seleccionada por defecto, sin requerir ninguna acción del usuario.
- **FR-003**: El sistema MUST garantizar que todo usuario tenga en todo momento exactamente dos estrategias propias; el sistema MUST NOT exponer ninguna operación para crear una estrategia adicional ni para eliminar alguna de las dos existentes.
- **FR-004**: El sistema MUST exponer GET /users/me/strategies, que devuelve, para el usuario autenticado, sus dos estrategias propias junto con un indicador de cuál de las dos está seleccionada.
- **FR-005**: El sistema MUST exponer PATCH /users/me/strategies/:id/select, que marca como seleccionada la estrategia indicada y deja la otra estrategia propia del mismo usuario como no seleccionada, garantizando que exactamente una quede seleccionada en todo momento.
- **FR-006**: El sistema MUST exponer PATCH /users/me/strategies/:id/weights para editar los pesos generales de una estrategia propia del usuario autenticado, sin importar si está o no seleccionada en ese momento.
- **FR-007**: El sistema MUST exponer PATCH /users/me/strategies/:id/position-weights/:position para editar el perfil de pesos de una posición reconocida (FW, MF, DF o GK) de una estrategia propia del usuario autenticado.
- **FR-008**: El sistema MUST validar, en toda edición de pesos generales o de un perfil de posición, que la suma algebraica de los pesos resultante sea 1.0 con tolerancia ±0.001; MUST rechazar la edición en su totalidad (sin persistir ningún cambio parcial) cuando esa condición no se cumpla.
- **FR-009**: El sistema MUST rechazar con una respuesta de acceso prohibido (403) cualquier intento de un usuario autenticado de seleccionar, o de editar los pesos generales o el perfil de alguna posición, de una estrategia que no es una de sus dos estrategias propias.
- **FR-010**: El sistema MUST exponer GET /players/:id/valuation, que calcula el valor de un jugador aplicando la estrategia actualmente seleccionada del usuario autenticado que consulta, sin persistir ningún registro.
- **FR-011**: GET /players/:id/valuation MUST permitir, mediante un parámetro de query, indicar cuál de las dos estrategias propias del usuario autenticado usar en ese cálculo puntual en lugar de la seleccionada, sin alterar cuál de las dos queda marcada como seleccionada.
- **FR-012**: El sistema MUST rechazar una consulta de GET /players/:id/valuation que indique por query una estrategia que no pertenece al usuario autenticado, de la misma forma que rechaza operar sobre una estrategia ajena en los endpoints de edición.
- **FR-013**: El sistema MUST exponer POST /users/me/quotes/recalculate, que recalcula y persiste una nueva cotización para los jugadores del catálogo usando la estrategia seleccionada del usuario autenticado en el momento de la ejecución.
- **FR-014**: POST /users/me/quotes/recalculate MUST aceptar un identificador de jugador opcional; si se indica, MUST recalcular y persistir la cotización únicamente para ese jugador; si se omite, MUST recalcular y persistir la cotización de todos los jugadores del catálogo.
- **FR-014a**: POST /users/me/quotes/recalculate MUST ejecutarse de forma síncrona: la respuesta MUST NOT devolverse hasta que el cálculo (de todos los jugadores del catálogo, o del jugador puntual indicado) haya terminado y las cotizaciones correspondientes hayan quedado persistidas.
- **FR-014b**: Cuando el recálculo abarca todo el catálogo (sin jugador puntual indicado) y falla el cálculo de un jugador puntual dentro del lote (por ejemplo, por falta de datos de métricas), el sistema MUST omitir únicamente a ese jugador y MUST continuar persistiendo la cotización del resto de los jugadores del catálogo, sin abortar la operación completa.
- **FR-015**: Cada cotización persistida por un recálculo MUST quedar asociada de forma inmutable al usuario autenticado que disparó el recálculo y a la estrategia (incluyendo, si corresponde, el perfil de posición) usada en ese cálculo puntual.
- **FR-016**: El sistema MUST NOT ejecutar ningún recálculo de cotizaciones de forma automática o programada; el recálculo solo MUST dispararse mediante una invocación explícita de un usuario a POST /users/me/quotes/recalculate.
- **FR-016a**: El sistema MUST rechazar con una respuesta de conflicto (409) una invocación a POST /users/me/quotes/recalculate de un usuario mientras ya tiene otro recálculo propio en curso, sin iniciar un segundo proceso en paralelo para ese mismo usuario; este bloqueo de concurrencia MUST aplicarse por usuario (un recálculo en curso de un usuario MUST NOT bloquear ni demorar el recálculo de ningún otro usuario).
- **FR-017**: El sistema MUST exponer GET /players/:id/quotes, autenticado mediante JWT, que devuelve el historial de cotizaciones de ese jugador generadas exclusivamente por los recálculos del usuario autenticado que consulta, nunca cotizaciones generadas por otro usuario.
- **FR-018**: El historial devuelto por GET /players/:id/quotes MUST estar ordenado cronológicamente de la cotización más antigua a la más reciente, y cada entrada MUST incluir, como mínimo, el valor calculado y la fecha en la que se generó. El endpoint MUST devolver la lista completa sin paginación.
- **FR-019**: Si el usuario autenticado todavía no disparó ningún recálculo para el jugador consultado, GET /players/:id/quotes MUST responder exitosamente con un historial vacío, sin generar ni mostrar ningún valor de partida automático.
- **FR-020**: El sistema MUST discontinuar el modelo de una única estrategia de sistema activada por un administrador para todos los consumidores (ver 012-valuation-strategies); ninguna operación administrativa de activación global de estrategias MUST permanecer disponible tras esta feature.

### Key Entities

- **ValuationStrategy** *(redefine su alcance)*: Estrategia de valuación con nombre, pesos generales por métrica (admite negativos) y, opcionalmente, perfiles de pesos por posición. Deja de ser un registro de sistema con un flag de "activa" global: pasa a pertenecer a exactamente un usuario (su dueño), que es el único autorizado a operar sobre ella. Cada usuario tiene siempre exactamente dos, fijas en cantidad, con un flag de "seleccionada" que indica cuál de las dos del mismo usuario rige por defecto sus valuaciones y recálculos.
- **PositionWeightProfile** *(hereda la propiedad de su ValuationStrategy)*: Perfil de pesos por posición (FW, MF, DF, GK) asociado a una ValuationStrategy. Al pasar la estrategia a ser propia de un usuario, el perfil de posición queda igualmente acotado a ese usuario de forma transitiva, sin cambios en su estructura ni en su regla de validación (suma = 1.0 ±0.001).
- **PlayerQuote** *(extiende entidad existente)*: Cotización calculada y persistida de un jugador, generada exclusivamente por un recálculo manual. Además de sus atributos ya existentes (jugador, estrategia, snapshot de pesos y perfil de posición usados, score, valor, timestamp de cálculo), queda asociada al usuario que disparó el recálculo que la generó. El historial de cotizaciones de un jugador deja de ser único por jugador para todo el sistema y pasa a estar segmentado por usuario.
- **User** *(extiende entidad existente)*: Usuario registrado del sistema (ver 001-user-auth). Gana la relación de ser dueño de exactamente dos ValuationStrategy propias, creadas automáticamente en el momento del alta.

## Design Decisions *(mandatory)*

### DD-001: Reemplazo de la estrategia única de sistema por dos estrategias propias de cada usuario

Antes de esta feature, el sistema mantenía dos estrategias de valuación de sistema, de las cuales un administrador activaba una para que rigiera el cálculo de cotizaciones de todos los jugadores para toda la plataforma (ver 012-valuation-strategies). Esta feature reemplaza ese modelo: ya no existe ninguna estrategia que no pertenezca a un usuario, ni ningún rol administrativo que la active globalmente. Cada usuario común recibe, al registrarse, una copia propia y editable de las mismas dos estrategias ya definidas ("Performance general" e "Impacto táctico", con los mismos pesos), fijas en cantidad —no puede crear otras ni eliminarlas—, pudiendo editar sus pesos y elegir cuál de las dos usar.

**Justificación**: La valuación de un jugador refleja un criterio que puede variar de un usuario a otro; una única estrategia de sistema impuesta centralmente no admite esa variación. Convertir las estrategias en copias propias por usuario habilita la personalización sin descartar la base conceptual ya validada (los mismos dos puntos de partida con los mismos pesos), y elimina la necesidad de un flujo administrativo dedicado exclusivamente a elegir una estrategia para todos.

### DD-002: El historial de cotizaciones pasa de ser único por jugador (sistema) a ser por usuario

El historial de cotizaciones, que antes era único por jugador para todo el sistema, pasa a ser por usuario — cada cotización persistida queda asociada a qué usuario la generó y con qué estrategia.

**Justificación**: Si el historial siguiera siendo único por jugador, las cotizaciones generadas por un usuario con su propia estrategia aparecerían mezcladas con las de otro usuario que editó sus pesos de forma distinta, haciendo que el gráfico de evolución de valor de cada usuario dejara de reflejar fielmente su propio criterio de valuación. Segmentar el historial por usuario es la consecuencia directa de que la estrategia dejó de ser única: cada usuario necesita ver la evolución de valor que resulta de sus propias decisiones (su estrategia seleccionada y sus propios recálculos), no una mezcla con las de otros.

### DD-003: El recálculo de cotizaciones deja de ser un job automático y pasa a ser exclusivamente manual por usuario

Antes de esta feature existía un job semanal automático que recalculaba las cotizaciones de todos los jugadores con la estrategia activa de sistema (ver 012-valuation-strategies, FR-014). Esta feature discontinúa ese job automático: el recálculo pasa a ser una acción manual que cada usuario dispara individualmente, cuando quiere actualizar su propio historial con las métricas más recientes de los jugadores, usando la estrategia que tiene seleccionada en ese momento.

**Justificación**: Al no existir más una única estrategia de sistema ni un historial compartido, ya no hay un recálculo único cuyo resultado sirva a todos los usuarios por igual; ejecutar un job automático tendría que recalcular por separado para cada usuario registrado con su propia estrategia seleccionada, lo cual escala mal y no responde a una necesidad real: el usuario que quiere ver su historial actualizado es quien mejor sabe cuándo pedirlo.

### DD-004: GET /players/:id/valuation calcula al vuelo y no persiste, a diferencia de POST /users/me/quotes/recalculate

Se mantienen dos vías para obtener el valor de un jugador: una de consulta exploratoria sin efectos secundarios (GET /players/:id/valuation) y otra de recálculo deliberado que sí deja un registro inmutable (POST /users/me/quotes/recalculate).

**Justificación**: Separar ambas operaciones evita que cada consulta exploratoria del usuario (por ejemplo, para comparar cómo valuaría un jugador con su otra estrategia antes de decidir cuál seleccionar, o antes de confirmar un cambio de pesos) genere ruido en su historial de evolución de valor, que está pensado para reflejar los momentos en los que el usuario decidió deliberadamente actualizar sus datos, no cada vez que simplemente mira el valor de un jugador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los usuarios nuevos quedan, inmediatamente después del alta y sin ninguna acción adicional, con exactamente dos estrategias propias y una de ellas seleccionada por defecto.
- **SC-002**: Un usuario puede cambiar cuál de sus dos estrategias está seleccionada en una única operación, quedando siempre exactamente una seleccionada antes y después del cambio.
- **SC-003**: El sistema rechaza el 100% de los intentos de guardar pesos (generales o de un perfil de posición) cuya suma quede fuera de 1.0 ±0.001, sin persistir cambios parciales en ningún caso.
- **SC-004**: El sistema rechaza el 100% de los intentos de un usuario de seleccionar o editar una estrategia que no es una de sus dos propias, sin aplicar ningún cambio sobre la estrategia ajena.
- **SC-005**: Ninguna consulta de valuación al vuelo de un jugador genera un registro nuevo en ningún historial, verificable comparando el historial del usuario antes y después de la consulta.
- **SC-006**: Cada recálculo manual disparado por un usuario deja, para cada jugador procesado, exactamente un registro nuevo e inmutable en el historial propio de ese usuario, visible en su siguiente consulta de historial.
- **SC-006a**: El sistema rechaza el 100% de los intentos de un mismo usuario de disparar un segundo recálculo mientras el primero propio sigue en curso, y nunca bloquea el recálculo de un usuario por uno en curso de otro usuario distinto.
- **SC-007**: El historial de cotizaciones que un usuario obtiene para un jugador nunca incluye una cotización generada por otro usuario, verificable comparando los historiales de dos usuarios distintos que recalcularon el mismo jugador.
- **SC-008**: Un usuario que todavía no disparó ningún recálculo para un jugador puntual obtiene, al consultar su historial para ese jugador, una respuesta exitosa con lista vacía, distinguible sin ambigüedad de un error.

## Assumptions

- La migración o el destino de las estrategias de sistema y del historial de cotizaciones generados antes de esta feature quedan fuera de alcance; se asume que este modelo reemplaza al anterior desde el momento en que se implementa en adelante.
- En GET /players/:id/valuation, "una estrategia puntual pasada por query" se interpreta como el identificador de una de las dos estrategias propias del usuario autenticado (no un conjunto arbitrario de pesos ad-hoc no persistido), preservando la regla de que un usuario únicamente puede valuar con sus propias estrategias.
- Los perfiles de pesos por posición (ver 014-position-weight-profiles) se copian junto con los pesos generales al crear las dos estrategias propias de cada usuario en el registro, y son editables mediante PATCH /users/me/strategies/:id/position-weights/:position bajo la misma regla de validación de suma = 1.0 ±0.001 que ya aplicaba a los perfiles de sistema.
- La reconciliación de GET /players/ranking (ver 016-player-ranking-endpoint), que hoy asume una única estrategia de sistema y un historial de cotizaciones único por jugador para construir el ranking, queda fuera de alcance de esta feature; su adaptación al modelo de estrategias por usuario se resuelve como un trabajo posterior.
- El rol administrativo y las capacidades de API key administrativa ya existentes (ver 008-admin-role-api-key) dejan de usarse para gestionar o activar estrategias de valuación tras esta feature; cualquier otro uso de ese rol ajeno a estrategias no se ve afectado.
- Las cuatro posiciones reconocidas para los perfiles de pesos (FW, MF, DF, GK) son las mismas ya definidas en 011-whoscored-player-metrics y 014-position-weight-profiles, sin cambios.
- Los endpoints bajo /users/me/strategies y POST /users/me/quotes/recalculate requieren la misma autenticación por JWT ya establecida para identificar al usuario operando (ver 001-user-auth); GET /players/:id/valuation también requiere JWT, dado que necesita identificar al usuario que consulta para resolver su estrategia seleccionada.
