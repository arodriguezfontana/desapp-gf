# Feature Specification: Superusuario y motor de matching de órdenes

**Feature Branch**: `020-order-matching-engine`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "El User incorpora un campo username (requerido, no único) vía migración. El valor \"superuser\" es un valor reservado: si alguien intenta registrarse con ese nombre exacto, el sistema responde 409 — esa es la única restricción sobre el campo, y es lo que garantiza que exista un único usuario con ese username. El seed crea al superusuario con username = \"superuser\", le carga un holding de 100 tokens por cada jugador existente, y le publica automáticamente una orden de venta (SELL) por esos 100 tokens de cada jugador, con el precio calculado según su propia estrategia seleccionada (la misma que recibe cualquier usuario nuevo, vía el hook de registro de 019). El mercado funciona matcheando órdenes de compra y venta — no hay un tramo especial contra el superusuario, es un usuario más que participa con sus propios tokens y su propia estrategia, igual que cualquiera. POST /orders recibe el lado (BUY o SELL), el jugador y la cantidad. No recibe precio: el precio de la orden se genera automáticamente en el momento de crearla, usando la estrategia seleccionada del usuario (de 019) — el mismo cálculo que expone GET /players/:id/valuation. Al crearse la orden, el sistema busca órdenes existentes del lado opuesto para ese jugador con exactamente el mismo precio — el motor de matching más simple posible, con match exacto. Entre las compatibles, matchea primero las más antiguas (FIFO). Si encuentra suficientes para cubrir toda la cantidad pedida, ejecuta la operación completa, pudiendo combinar varias órdenes de la contraparte si hace falta (fill parcial sobre cada una de ellas). Si solo cubre una parte, ejecuta esa parte y la cantidad restante queda como una nueva orden PENDING en el libro. Si no encuentra ninguna orden compatible, toda la cantidad pedida queda como una orden PENDING nueva. Por cada porción ejecutada se transfieren los tokens entre los holdings de ambas partes y se registran dos TokenTransaction (una CREDIT, una DEBIT)."

## Clarifications

### Session 2026-10-16

- Q: When the system compares prices for an exact match, how should it treat the number (decimal precision/rounding) so two independently-calculated prices are reliably considered "the same"? → A: Round the calculated price to a fixed decimal precision (2 decimals) before storing/comparing.
- Q: Does placing a BUY order require the user to have any funds/balance reserved up front, the same way a SELL order requires having enough tokens in holdings? → A: No funds check on BUY — any authenticated user can place a BUY order for any quantity regardless of balance.
- Q: Does order cancellation (the only way to change a desired price, per DD-003) already exist in the system today, or does this feature need to introduce it? → A: No, queda fuera de esta feature; se agrega en una feature separada que viene después.
- Q: Does the system need an explicit concurrency-safety guarantee to prevent double-filling or lost updates when two orders could match concurrently? → A: System MUST guarantee atomic/serialized consumption of an order's remaining quantity — no overfill possible even under concurrent requests.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reservar el username "superuser" para un único usuario del sistema (Priority: P1)

El sistema agrega un campo username a cada usuario. Nadie puede registrarse usando exactamente el valor "superuser", de modo que ese nombre quede garantizado para un único usuario especial que el sistema provee (el superusuario provisto por el seed).

**Why this priority**: Es la base que garantiza que exista un único superusuario identificable por username; sin esta restricción, cualquier persona podría registrarse como "superuser" y el seed fallaría o se volvería ambiguo.

**Independent Test**: Se puede testear de forma aislada intentando registrar una cuenta nueva con username = "superuser" y verificando que la operación se rechaza con 409, sin crear ningún usuario nuevo; y por separado, registrando una cuenta con cualquier otro username (incluso uno repetido entre dos usuarios distintos) y verificando que ambos registros se aceptan.

**Acceptance Scenarios**:

1. **Given** que no existe todavía ningún usuario registrándose, **When** alguien intenta registrarse con username = "superuser", **Then** el sistema rechaza la operación respondiendo 409 y no crea ninguna cuenta.
2. **Given** dos personas distintas que se registran por separado, **When** ambas eligen el mismo username (cualquiera que no sea "superuser"), **Then** ambos registros se completan exitosamente, porque el campo no es único salvo por el valor reservado.
3. **Given** el seed del sistema ya ejecutado, **When** se inspeccionan los usuarios existentes, **Then** existe exactamente un usuario con username = "superuser".

---

### User Story 2 - El seed provee al superusuario con holdings y órdenes de venta iniciales (Priority: P1)

Al correr el seed, el superusuario queda con un holding de 100 tokens de cada jugador existente en el catálogo, y con una orden de venta (SELL) publicada por esos 100 tokens de cada jugador, a un precio calculado con la estrategia seleccionada del superusuario (la misma asignación automática de estrategias que recibe cualquier usuario nuevo).

**Why this priority**: Sin liquidez inicial del lado de la venta, el mercado no tendría ninguna orden contra la cual matchear las primeras órdenes de compra de los demás usuarios; es el punto de partida que hace operable el resto de la feature.

**Independent Test**: Se puede testear de forma aislada corriendo el seed sobre una base vacía de catálogo con jugadores ya cargados, y verificando que el superusuario queda con un holding de 100 tokens por cada jugador y con exactamente una orden SELL PENDING por jugador, por 100 tokens, al precio resultante de su estrategia seleccionada para ese jugador.

**Acceptance Scenarios**:

1. **Given** un catálogo de jugadores ya cargado antes de correr el seed, **When** el seed se ejecuta, **Then** el superusuario queda con un holding de exactamente 100 tokens de cada jugador del catálogo.
2. **Given** el mismo seed, **When** se inspeccionan las órdenes del superusuario, **Then** existe exactamente una orden SELL PENDING por cada jugador, por una cantidad de 100 tokens, con el precio calculado según la estrategia seleccionada del superusuario para ese jugador en el momento del seed.
3. **Given** el seed ya ejecutado, **When** se compara el precio de cada orden SELL del superusuario con el valor que devolvería GET /players/:id/valuation para el superusuario sobre ese mismo jugador en ese momento, **Then** ambos valores coinciden.

---

### User Story 3 - Publicar una orden de compra o venta sin indicar precio (Priority: P1)

Un usuario autenticado publica una orden indicando únicamente el lado (BUY o SELL), el jugador y la cantidad de tokens; el sistema calcula automáticamente el precio de esa orden en el momento de crearla, usando la estrategia de valuación seleccionada de ese usuario para ese jugador.

**Why this priority**: Es la operación central que habilita el mercado: sin poder crear órdenes con un precio derivado de la propia estrategia del usuario, no existiría ningún flujo de compra/venta sobre el cual aplicar el matching.

**Independent Test**: Se puede testear de forma aislada creando una orden (BUY o SELL) para un usuario y un jugador sin indicar precio, y verificando que la orden queda registrada con un precio igual al que devuelve GET /players/:id/valuation para ese usuario y ese jugador en ese momento.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con holdings suficientes del jugador (para SELL) o sin restricción adicional (para BUY), **When** publica una orden indicando lado, jugador y cantidad, **Then** el sistema crea la orden con el precio calculado automáticamente según la estrategia seleccionada de ese usuario para ese jugador, sin que el usuario haya indicado ningún precio.
2. **Given** dos usuarios con estrategias seleccionadas distintas, **When** cada uno publica una orden para el mismo jugador y la misma cantidad, **Then** cada orden queda con el precio propio que resulta de la estrategia de quien la publicó, pudiendo diferir entre ambas órdenes.
3. **Given** un jugador que no existe en el catálogo, **When** un usuario intenta publicar una orden para ese jugador, **Then** el sistema rechaza la operación informando que el jugador no existe, sin crear ninguna orden.

---

### User Story 4 - Matchear automáticamente una orden nueva contra el libro existente (Priority: P1)

Al crearse una orden nueva, el sistema busca en el libro órdenes existentes del lado opuesto para el mismo jugador con exactamente el mismo precio, y ejecuta la cantidad que logre cubrir contra la contraparte más antigua disponible primero (FIFO), pudiendo combinar varias órdenes de la contraparte si una sola no alcanza para cubrir toda la cantidad pedida.

**Why this priority**: Es el mecanismo que efectivamente convierte la publicación de órdenes en operaciones reales de compraventa; sin el matching, las órdenes se acumularían en el libro sin que nunca se transfiera ningún token.

**Independent Test**: Se puede testear de forma aislada publicando primero una orden SELL de un jugador a un precio dado, luego una orden BUY del mismo jugador al mismo precio por una cantidad menor o igual, y verificando que la cantidad pedida se ejecuta por completo, con la transferencia de tokens correspondiente entre ambos holdings.

**Acceptance Scenarios**:

1. **Given** una orden PENDING existente del lado opuesto para el mismo jugador con exactamente el mismo precio que cubre sola toda la cantidad pedida, **When** se crea la orden nueva, **Then** el sistema ejecuta la cantidad completa contra esa única orden existente.
2. **Given** varias órdenes PENDING del lado opuesto para el mismo jugador con exactamente el mismo precio, ninguna de las cuales cubre sola la cantidad pedida pero que combinadas sí la cubren, **When** se crea la orden nueva, **Then** el sistema ejecuta fills parciales contra varias de esas órdenes, empezando por la más antigua (FIFO), hasta cubrir la cantidad completa pedida.
3. **Given** órdenes PENDING del lado opuesto para el mismo jugador con exactamente el mismo precio cuya cantidad combinada alcanza solo para cubrir una parte de lo pedido, **When** se crea la orden nueva, **Then** el sistema ejecuta esa parte cubierta y la cantidad restante queda registrada como una nueva orden PENDING en el libro, a la espera de una contraparte futura al mismo precio.
4. **Given** que no existe en el libro ninguna orden del lado opuesto para ese jugador con exactamente el mismo precio (ya sea porque no hay ninguna orden del lado opuesto, o porque existen a un precio distinto), **When** se crea la orden nueva, **Then** toda la cantidad pedida queda registrada como una nueva orden PENDING, sin ejecutar nada.
5. **Given** órdenes existentes del lado opuesto para el mismo jugador a un precio distinto del de la orden nueva, **When** se crea la orden nueva, **Then** esas órdenes a precio distinto no se consideran compatibles y no participan del matching, aunque estén "cerca" en precio.
6. **Given** una orden del superusuario y una orden de cualquier otro usuario que resultan compatibles en jugador, lado opuesto y precio exacto, **When** se evalúa el matching, **Then** se ejecutan entre sí exactamente igual que si ambas fueran de dos usuarios comunes, sin ningún tratamiento especial para el superusuario.

---

### User Story 5 - Registrar la transferencia de tokens y las transacciones de cada ejecución (Priority: P1)

Por cada porción ejecutada de una operación de matching, el sistema transfiere la cantidad correspondiente de tokens entre los holdings de ambas partes (comprador y vendedor) y registra dos movimientos de transacción de tokens, uno de crédito y uno de débito, dejando trazabilidad de cada ejecución.

**Why this priority**: Sin esta contabilización, el matching no tendría ningún efecto observable sobre los holdings de los usuarios ni dejaría rastro verificable de lo ejecutado.

**Independent Test**: Se puede testear de forma aislada provocando una ejecución completa entre dos órdenes compatibles y verificando que el holding del comprador aumenta en la cantidad ejecutada, el del vendedor disminuye en la misma cantidad, y quedan registradas exactamente una transacción CREDIT y una DEBIT asociadas a esa ejecución.

**Acceptance Scenarios**:

1. **Given** una ejecución (completa o parcial) entre una orden BUY y una orden SELL compatibles, **When** la ejecución se concreta, **Then** el holding del comprador para ese jugador aumenta exactamente en la cantidad ejecutada y el holding del vendedor disminuye exactamente en esa misma cantidad.
2. **Given** la misma ejecución, **When** se inspeccionan las transacciones generadas, **Then** existen exactamente dos TokenTransaction nuevas asociadas a esa ejecución: una de tipo CREDIT y una de tipo DEBIT, cada una por la cantidad ejecutada.
3. **Given** una orden que se ejecuta combinando fills parciales contra varias órdenes de la contraparte (ver Historia 4, escenario 2), **When** se inspeccionan las transacciones generadas, **Then** existe un par de TokenTransaction (CREDIT y DEBIT) por cada una de esas ejecuciones parciales, reflejando la cantidad efectivamente ejecutada contra cada contraparte.

---

### Edge Cases

- ¿Qué sucede si un usuario publica una orden SELL por una cantidad de tokens mayor a la que tiene en su holding para ese jugador? → El sistema rechaza la operación, sin crear ninguna orden ni afectar el holding.
- ¿Qué sucede si, entre que se calcula el precio de la orden nueva y se la intenta matchear, no existe ninguna ambigüedad porque todo el cálculo y el matching ocurren dentro de la misma operación de creación de la orden? → No hay ventana de inconsistencia: el precio se calcula y el matching se ejecuta como parte de una única operación de creación.
- ¿Qué sucede si una orden queda PENDING a un precio que nunca vuelve a coincidir exactamente con ninguna contraparte futura? → Queda esperando indefinidamente en el libro sin ejecutarse nunca; este riesgo se acepta explícitamente como parte de la simplicidad deliberada del motor de matching (ver DD-001).
- ¿Puede un usuario editar el precio de una orden PENDING ya creada? → No; el sistema no expone ninguna operación para editar el precio de una orden existente. Cancelar una orden y crear una nueva con el precio recalculado es, conceptualmente, la única vía para cambiar el precio deseado, pero la capacidad de cancelación en sí queda fuera de alcance de esta feature (se entrega en una feature posterior); mientras esa capacidad no exista, una orden PENDING a un precio no deseado no tiene, dentro de esta feature, ninguna forma de ser revertida.
- ¿Qué pasa si dos solicitudes de creación de orden intentan matchear concurrentemente contra la misma orden existente? → El sistema MUST consumir la cantidad pendiente de esa orden de forma atómica/serializada, de modo que la suma de los fills ejecutados contra ella nunca exceda su cantidad disponible, sin importar cuántas solicitudes concurrentes compitan por ella.
- ¿Qué sucede si un usuario intenta matchear contra su propia orden PENDING (orden de signo opuesto, mismo jugador, mismo precio, mismo usuario en ambos lados)? → Se trata igual que cualquier otra contraparte compatible: el sistema no distingue si ambas puntas pertenecen al mismo usuario.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST agregar al usuario un campo username, requerido en el registro, sin restricción de unicidad salvo por el valor exacto "superuser".
- **FR-002**: El sistema MUST rechazar con una respuesta de conflicto (409) cualquier intento de registro cuyo username sea exactamente "superuser", sin crear ninguna cuenta en ese intento.
- **FR-003**: El sistema MUST permitir que dos o más usuarios distintos compartan el mismo username, siempre que ese valor no sea "superuser".
- **FR-004**: El seed del sistema MUST crear, si no existe, exactamente un usuario con username = "superuser".
- **FR-005**: El seed MUST asignarle al superusuario, al igual que a cualquier usuario nuevo, sus dos estrategias de valuación propias con una seleccionada por defecto (ver 019-per-user-valuation-strategies).
- **FR-006**: El seed MUST cargar al superusuario un holding de 100 tokens de cada jugador existente en el catálogo al momento de correr el seed.
- **FR-007**: El seed MUST publicar, por cada jugador del catálogo, una orden SELL PENDING del superusuario por los 100 tokens cargados de ese jugador, con el precio calculado según la estrategia seleccionada del superusuario para ese jugador en ese momento.
- **FR-008**: El sistema MUST exponer POST /orders, que recibe el lado de la orden (BUY o SELL), el jugador y la cantidad de tokens, y MUST NOT aceptar un precio indicado por quien publica la orden.
- **FR-009**: Al crear una orden mediante POST /orders, el sistema MUST calcular su precio automáticamente usando la estrategia de valuación seleccionada del usuario autenticado para ese jugador, con el mismo cálculo que expone GET /players/:id/valuation.
- **FR-010**: El sistema MUST rechazar la creación de una orden SELL cuando el usuario autenticado no tiene, en su holding de ese jugador, al menos la cantidad de tokens indicada en la orden.
- **FR-011**: Al crearse una orden nueva, el sistema MUST buscar, entre las órdenes PENDING existentes, aquellas del lado opuesto para el mismo jugador con un precio exactamente igual al de la orden nueva, como único criterio de compatibilidad para el matching.
- **FR-011a**: El sistema MUST redondear todo precio calculado automáticamente (incluyendo los del seed) a 2 decimales antes de persistirlo y antes de compararlo para el matching, de modo que dos valuaciones conceptualmente iguales produzcan siempre el mismo valor comparado.
- **FR-012**: Entre las órdenes compatibles encontradas, el sistema MUST priorizar el matching contra las órdenes más antiguas primero (FIFO).
- **FR-013**: Si las órdenes compatibles alcanzan, combinadas si es necesario, para cubrir la totalidad de la cantidad pedida por la orden nueva, el sistema MUST ejecutar la operación completa, pudiendo aplicar un fill parcial sobre una o más de las órdenes de la contraparte involucradas.
- **FR-014**: Si las órdenes compatibles solo alcanzan para cubrir una parte de la cantidad pedida, el sistema MUST ejecutar esa parte cubierta y MUST registrar la cantidad restante como una nueva orden PENDING en el libro, al mismo precio que la orden original.
- **FR-015**: Si no existe ninguna orden compatible, el sistema MUST registrar la totalidad de la cantidad pedida como una nueva orden PENDING, sin ejecutar ninguna operación.
- **FR-016**: Por cada porción ejecutada de una operación de matching, el sistema MUST transferir la cantidad ejecutada de tokens del holding del vendedor al holding del comprador para ese jugador.
- **FR-017**: Por cada porción ejecutada, el sistema MUST registrar exactamente dos TokenTransaction: una CREDIT (asociada al comprador) y una DEBIT (asociada al vendedor), cada una por la cantidad ejecutada en esa porción.
- **FR-018**: El sistema MUST NOT exponer ninguna operación para editar el precio de una orden ya creada. La cancelación de una orden (que permitiría luego crear una nueva con un precio distinto) queda explícitamente fuera de alcance de esta feature y se entrega en una feature separada posterior; mientras tanto, esta feature MUST NOT exponer tampoco ninguna operación de cancelación.
- **FR-019**: El sistema MUST tratar al superusuario como un usuario de mercado más a los efectos del matching: ninguna orden del superusuario MUST recibir prioridad, tramo especial, o criterio de compatibilidad distinto del aplicado a cualquier otro usuario.
- **FR-020**: El sistema MUST NOT exigir ningún chequeo de fondos o balance para crear una orden BUY; una orden BUY se acepta por cualquier cantidad indicada sin validar saldo alguno del usuario que la publica.
- **FR-021**: El sistema MUST garantizar que la cantidad pendiente de una orden se consuma de forma atómica/serializada durante el matching, de modo que ninguna combinación de solicitudes concurrentes pueda hacer que una orden se llene (fill) por una cantidad mayor a la que tenía disponible.

### Key Entities

- **User** *(extiende entidad existente)*: Usuario registrado del sistema (ver 001-user-auth). Gana el campo username (requerido, no único salvo por el valor reservado "superuser"). El superusuario es el único usuario con username = "superuser", provisto por el seed con holdings y órdenes iniciales, pero sin ningún atributo o privilegio adicional a nivel de mercado respecto de cualquier otro usuario.
- **Order**: Orden de compra o venta publicada por un usuario para un jugador. Tiene lado (BUY o SELL), jugador, cantidad, precio (calculado automáticamente al crearse, nunca indicado por quien la publica, e inmutable una vez creada), estado (PENDING o, cuando se completa su ejecución, el estado que refleje que ya no tiene cantidad pendiente) y la fecha/hora de creación (usada para el orden FIFO del matching).
- **TokenTransaction** *(extiende entidad existente, ver 017-buy-tokens)*: Movimiento de tokens de un holding. Cada ejecución de matching genera un par de registros, uno CREDIT y uno DEBIT, asociados a la porción de cantidad ejecutada entre una orden BUY y una orden SELL compatibles.
- **TokenHolding** *(entidad existente)*: Cantidad de tokens que un usuario posee de un jugador determinado. Se incrementa en el holding del comprador y se decrementa en el holding del vendedor por cada porción ejecutada.

## Design Decisions *(mandatory)*

### DD-001: Motor de matching deliberadamente simple, con match exacto de precio

El matching de órdenes se resuelve con el criterio más simple posible: una orden nueva solo matchea contra órdenes existentes del lado opuesto, mismo jugador, con un precio exactamente igual, priorizando FIFO entre las compatibles. No se implementa ningún mecanismo de rango de precio, tolerancia, ni negociación entre puntas con precios distintos.

**Justificación**: Arrancar con el motor de matching más simple posible (match exacto) permite tener un mercado funcional de punta a punta sin la complejidad adicional de resolver qué hacer cuando los precios no coinciden exactamente (a qué precio ejecutar, cómo repartir el spread, etc.). Funcionalidades como rangos de precio o negociación quedan como una evolución posible más adelante, solo si el tiempo lo permite, en lugar de bloquear la primera versión operativa del mercado.

### DD-002: Riesgo aceptado — una orden a un precio no coincidente puede quedar pendiente indefinidamente

Como consecuencia directa de DD-001, una orden cuyo precio no coincide exactamente con ninguna orden del lado opuesto para el mismo jugador puede quedar en estado PENDING indefinidamente, incluso si existen otras órdenes a un precio "cercano" que, en un motor más sofisticado, podrían haber sido candidatas a ejecutarse.

**Justificación**: Este riesgo se acepta de forma explícita como el costo de la simplicidad elegida en DD-001; resolverlo (por ejemplo, con rangos de precio o algún mecanismo de acercamiento de puntas) queda fuera de alcance de esta feature y se trata como trabajo futuro si corresponde.

### DD-003: Sin edición de precio sobre una orden existente, y sin cancelación en esta feature

No existe ninguna operación para modificar el precio de una orden ya creada. Conceptualmente, cancelar la orden existente y crear una nueva con el precio recalculado sería la vía para cambiar el precio deseado — pero la capacidad de cancelación en sí misma queda fuera de alcance de esta feature; se entrega en una feature separada posterior. Mientras esa capacidad no exista, una orden PENDING a un precio no deseado no tiene, dentro de esta feature, ninguna forma de ser revertida ni recreada a otro precio.

**Justificación**: Permitir editar el precio de una orden PENDING complicaría el motor de matching (por ejemplo, qué pasa si la edición vuelve compatible una orden que ya estaba en el libro desde antes) sin agregar valor proporcional en esta primera versión. Se eligió, además, no incluir la cancelación en este incremento: el enfoque de esta feature es entregar el motor de matching y la liquidez inicial del superusuario; la gestión del ciclo de vida de una orden ya creada (cancelarla) se trata como una pieza independiente a entregar después.

### DD-004: El superusuario es un participante de mercado más, sin tramo especial

El superusuario, provisto por el seed con holdings y órdenes de venta iniciales, participa del matching exactamente igual que cualquier otro usuario: sus órdenes se evalúan con el mismo criterio de compatibilidad (mismo jugador, lado opuesto, precio exacto) y el mismo orden FIFO que las de cualquier otro usuario, sin ninguna prioridad, descuento, ni camino de ejecución reservado.

**Justificación**: El propósito del superusuario es únicamente dotar al mercado de liquidez inicial del lado de la venta para que existan contrapartes desde el primer momento; introducir un tramo especial de ejecución contra él agregaría una regla de negocio adicional que no es necesaria para cumplir ese propósito y rompería la uniformidad del motor de matching descrita en DD-001.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los intentos de registro con username = "superuser" son rechazados con 409, y en todo momento existe como máximo un usuario con ese username.
- **SC-002**: Después de correr el seed sobre un catálogo con N jugadores, el superusuario tiene exactamente N órdenes SELL PENDING (una por jugador) y un holding de 100 tokens de cada uno de esos N jugadores.
- **SC-003**: El 100% de las órdenes creadas vía POST /orders quedan con un precio igual al que devolvería GET /players/:id/valuation para el mismo usuario y jugador en ese momento, sin que el creador haya indicado ningún precio.
- **SC-004**: El 100% de las ejecuciones de matching (completas o parciales) generan exactamente un par de TokenTransaction (una CREDIT, una DEBIT) y dejan los holdings de ambas partes actualizados de forma consistente con la cantidad ejecutada.
- **SC-005**: Ante dos o más órdenes compatibles disponibles para una orden nueva, el 100% de los fills se aplican respetando el orden FIFO (la orden existente más antigua se cubre primero).
- **SC-006**: El 100% de las órdenes nuevas que no encuentran ninguna contraparte compatible quedan registradas como PENDING por la totalidad de la cantidad pedida, sin generar ninguna ejecución ni transacción.
- **SC-007**: No existe ninguna operación disponible en el sistema que permita modificar el precio de una orden ya creada, ni ninguna operación de cancelación (fuera de alcance de esta feature).
- **SC-008**: El 100% de las solicitudes concurrentes de creación de órdenes que compiten por la misma orden existente dejan esa orden con una cantidad consumida que nunca excede su cantidad disponible, verificable repitiendo solicitudes simultáneas sobre el mismo par de órdenes compatibles.

## Assumptions

- El campo username no reemplaza ningún mecanismo de identificación o autenticación existente (ver 001-user-auth); es un atributo adicional del usuario, sin impacto en el login ni en la emisión de tokens de sesión.
- "Lado opuesto" para el matching significa: una orden BUY solo matchea contra órdenes SELL, y viceversa, nunca contra órdenes del mismo lado.
- El estado de una orden que se ejecuta por completo (ya sea de una sola vez o acumulando varios fills parciales hasta cubrir toda su cantidad) deja de estar PENDING; el valor concreto de ese estado (p. ej. FILLED) se asume como el nombre natural para "ejecutada en su totalidad", sin que el nombre exacto afecte el comportamiento funcional descripto.
- El seed es idempotente respecto del superusuario: si ya existe un usuario con username = "superuser" al correrlo nuevamente, el seed no intenta crear un segundo usuario con ese username (ver FR-002, que lo impediría de todos modos vía el flujo de registro).
- El precio de una orden, una vez creada, es inmutable incluso si la estrategia seleccionada del usuario cambia después (ver 019-per-user-valuation-strategies); los fills futuros contra esa orden siempre usan el precio congelado al momento de su creación, no un recálculo posterior.
- La cantidad de tokens en una orden y en los holdings se asume expresada en unidades enteras, consistente con el modelo ya establecido en 017-buy-tokens.
