# Feature Specification: Libro de Órdenes por Jugador (Player Order Book)

**Feature Branch**: `024-player-order-book`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "GET /players/:id/order-book devuelve las órdenes activas (PENDING y PARTIALLY_FILLED) de ese jugador, separadas por lado (BUY y SELL), con el precio y la cantidad remanente de cada una — sin exponer de quién es cada orden, solo cuánta oferta y demanda hay disponible a cada precio. Pensado para que el usuario vea, antes de crear su propia orden, si hay algo con lo que matchear inmediatamente a algún precio, o si va a quedar esperando. Las órdenes se agrupan por precio dentro de cada lado (igual que en un libro de órdenes real), mostrando la cantidad total disponible en cada nivel de precio, no una fila por orden individual. La decisión de diseño a documentar es que el libro no identifica al vendedor ni al comprador detrás de cada nivel — es información agregada de mercado, no un detalle transaccional por usuario. Queda fuera de alcance, aceptado como riesgo: no se actualiza en tiempo real (vía websocket o polling automático), el usuario tiene que volver a consultar el endpoint para ver cambios."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulta de profundidad y liquidez del mercado por jugador (Priority: P1)

Como usuario inversor que evalúa comprar o vender tokens de un futbolista, quiero consultar la oferta y demanda disponible en el mercado agrupada por nivel de precio, para evaluar si al publicar mi orden existirá contrapartida inmediata con la cual ejecutar un intercambio total o parcial, o si mi postura quedará en espera.

**Why this priority**: Es la funcionalidad esencial del libro de órdenes. Otorga transparencia a la liquidez del mercado y permite al usuario tomar decisiones informadas sobre la colocación de sus posturas en base a los precios y cantidades remanentes existentes.

**Independent Test**: Puede probarse creando órdenes de compra y venta activas para un jugador determinado y consultando el libro de órdenes del jugador. Se verifica que el sistema responde con la oferta (ventas) y demanda (compras) agrupadas por nivel de precio, con el remanente agregado correcto y ordenadas canónicamente.

**Acceptance Scenarios**:

1. **Given** un jugador con múltiples órdenes activas de compra (`BUY`) a diferentes precios, **When** el usuario consulta el libro de órdenes del jugador, **Then** el sistema devuelve los niveles de demanda (`bids`) agrupados por precio y ordenados de mayor a menor precio (precio más alto primero).
2. **Given** un jugador con múltiples órdenes activas de venta (`SELL`) a diferentes precios, **When** el usuario consulta el libro de órdenes del jugador, **Then** el sistema devuelve los niveles de oferta (`asks`) agrupados por precio y ordenados de menor a mayor precio (precio más bajo primero).
3. **Given** varias órdenes activas en el mismo lado que comparten exactamente el mismo precio unitario, **When** se consulta el libro de órdenes, **Then** el sistema consolida dichas posturas en un único nivel de precio cuya cantidad total (`totalQuantity`) es la suma de los remanentes no ejecutados (`remainingQuantity`) de todas las órdenes en ese nivel.
4. **Given** órdenes que se encuentran parcialmente ejecutadas (`PARTIALLY_FILLED`), **When** se computa el libro de órdenes, **Then** el sistema únicamente contabiliza la cantidad remanente que aún no fue ejecutada (`remainingQuantity`), ignorando la cantidad original que ya fue objeto de intercambio.

---

### User Story 2 - Anonimato y agregación de mercado (Priority: P2)

Como participante del mercado financiero de tokens, quiero que la información del libro de órdenes sea agregada y confidencial respecto a la identidad de los operadores, para preservar la privacidad de las posiciones individuales y prevenir prácticas desleales de persecución o discriminación de contrapartes.

**Why this priority**: Es una regla no negociable de diseño del mercado: el libro de órdenes provee una visión macro y agregada de liquidez, sin exponer detalles personales, identificadores de usuario ni identificadores individuales de órdenes.

**Independent Test**: Puede verificarse consultando el libro de órdenes con cualquier usuario y comprobando que la estructura de datos resultante contiene exclusivamente niveles de precio y volumen agregado, sin campos que revelen `userId`, identidades de compradores/vendedores o IDs de órdenes individuales.

**Acceptance Scenarios**:

1. **Given** un libro de órdenes poblado por posturas de múltiples usuarios distintos, **When** cualquier usuario autenticado consulta el libro de órdenes, **Then** la respuesta contiene únicamente niveles de precio con su respectivo precio y cantidad agregada, sin revelar en ningún campo los identificadores de usuario (`userId`) ni los identificadores de las órdenes individuales (`orderId`).
2. **Given** un usuario que posee órdenes propias activas para el jugador consultado, **When** dicho usuario solicita el libro de órdenes, **Then** sus posturas se computan de forma agregada e indistinguible junto a las del resto de los participantes del mercado.

---

### User Story 3 - Manejo de estados vacíos y validación de existencia del jugador (Priority: P3)

Como usuario o aplicación cliente, quiero consultar el libro de órdenes de un jugador que actualmente no tiene posturas y recibir una respuesta consistente de libro vacío, así como recibir un mensaje de error claro cuando el jugador solicitado no existe en el sistema.

**Why this priority**: Garantiza la estabilidad de la experiencia del usuario y el correcto manejo de errores estándar ante identificadores no válidos o activos sin liquidez.

**Independent Test**: Puede probarse consultando un jugador existente sin órdenes (debe retornar 200 OK con listas vacías en compras y ventas) y un jugador con ID inexistente (debe retornar 404 Not Found).

**Acceptance Scenarios**:

1. **Given** un jugador registrado en el catálogo para el cual no existe ninguna orden activa en el mercado (o todas sus órdenes previas están `COMPLETED` o `CANCELLED`), **When** se consulta su libro de órdenes, **Then** el sistema responde con código HTTP 200 OK y listas vacías tanto para compras (`bids: []`) como para ventas (`asks: []`).
2. **Given** un identificador de jugador que no existe en el catálogo, **When** el usuario solicita su libro de órdenes, **Then** el sistema rechaza la solicitud con código HTTP 404 (Not Found) indicando que el jugador no fue encontrado.
3. **Given** una solicitud enviada sin credenciales de autenticación válidas o con un token JWT vencido, **When** el servidor procesa el pedido, **Then** el sistema responde con código HTTP 401 (Unauthorized).

---

### Edge Cases

- **Órdenes en estados terminales (`COMPLETED` o `CANCELLED`)**: El sistema debe ignorarlas por completo; ningún remanente de una orden completada o cancelada debe figurar en ningún nivel de precio del libro.
- **Asimetría de mercado (Solo compras o solo ventas)**: Si un jugador solo tiene posturas de compra abiertas, `asks` debe ser un array vacío y `bids` debe listar los niveles ordenados; análogamente si solo hay posturas de venta.
- **Múltiples órdenes pequeñas al mismo precio**: La agregación debe sumar correctamente cantidades grandes o pequeñas sin errores de redondeo en los totales de cantidad.
- **Precios idénticos con diferente precisión o formato**: Los niveles de precio deben consolidarse con exactitud decimal de dos dígitos (`DECIMAL(10, 2)`), asegurando que órdenes al mismo precio monetario se agrupen en la misma fila.
- **Identificador de jugador con formato UUID inválido**: Debe rechazarse con código HTTP 400 (Bad Request).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer la consulta del libro de órdenes de un jugador mediante una petición `GET /players/:id/order-book`.
- **FR-002**: El sistema DEBE exigir autenticación de usuario mediante un token JWT válido para acceder al libro de órdenes (`JwtAuthGuard`).
- **FR-003**: El sistema DEBE verificar la existencia del jugador correspondiente al identificador recibido; si no existe, DEBE responder con código HTTP 404 (Not Found).
- **FR-004**: El sistema DEBE incluir en el cálculo del libro de órdenes únicamente aquellas órdenes asociadas al jugador que se encuentren en estado activo (`PENDING` o `PARTIALLY_FILLED`).
- **FR-005**: El sistema DEBE separar las órdenes activas en dos colecciones independientes: posturas de demanda (`bids`, correspondientes a `side: BUY`) y posturas de oferta (`asks`, correspondientes a `side: SELL`).
- **FR-006**: Dentro de cada lado del libro, el sistema DEBE agrupar las órdenes por nivel de precio unitario, consolidando en un único elemento el precio y la suma de las cantidades remanentes (`remainingQuantity`) de todas las órdenes activas que compartan dicho precio.
- **FR-007**: El sistema DEBE ordenar los niveles de precio de forma canónica de mercado:
  - Los niveles de compra (`bids`) DEBEN ordenarse por precio de forma descendente (el mejor precio de compra primero).
  - Los niveles de venta (`asks`) DEBEN ordenarse por precio de forma ascendente (el mejor precio de venta primero).
- **FR-008**: La respuesta del libro de órdenes NO DEBE exponer información sensible de los usuarios ni identificadores de órdenes individuales; únicamente DEBE contener datos agregados de precio y cantidad.
- **FR-009**: Si no existen órdenes activas en alguno de los dos lados (o en ninguno), el sistema DEBE retornar una lista vacía para dicho lado (`[]`) manteniendo el código de respuesta HTTP 200 OK.

---

### Key Entities

- **OrderBook**: Representa la instantánea del mercado para un jugador determinado en un instante dado. Contiene el identificador del jugador y dos listas ordenadas de niveles de precio: `bids` (compras) y `asks` (ventas).
- **PriceLevel**: Representa un nivel de precio consolidado dentro de un lado del libro de órdenes. Atributos:
  - `price`: Precio unitario expresado en formato monetario estándar (`DECIMAL(10,2)`).
  - `totalQuantity`: Suma entera positiva de las cantidades remanentes de todas las órdenes activas a ese precio.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La consulta del libro de órdenes para cualquier jugador retorna en menos de 300 ms bajo condiciones normales de carga local.
- **SC-002**: El 100% de las órdenes en estado `COMPLETED` o `CANCELLED` quedan excluidas del libro de órdenes, garantizando que el volumen ofertado o demandado coincida con la liquidez real disponible para cruce.
- **SC-003**: El 100% de las respuestas del endpoint protegen la identidad de los operadores, sin incluir campos de `userId`, nombres de usuario ni IDs de orden.
- **SC-004**: Los niveles de precio se consolidan sin duplicaciones de precio en un mismo lado (100% de los niveles con precio único por lado).

---

## Assumptions & Design Decisions

- **Agregación por nivel de precio**: Siguiendo las convenciones de libros de órdenes financieros (Order Book Level 2), el endpoint consolida el volumen total por cada precio distinto en lugar de exponer un listado de transacciones u órdenes individuales.
- **Inmutabilidad y privacidad**: El anonimato es un principio rector de la feature. Los participantes ven qué liquidez existe y a qué precio, pero no quién la ofrece.
- **Consulta bajo demanda (Snapshot)**: Queda explícitamente fuera de alcance la actualización en tiempo real mediante WebSockets, Server-Sent Events o sondeos automáticos por parte del servidor. El cliente o usuario debe reejecutar la consulta para obtener los cambios del mercado tras nuevos cruces o cancelaciones.
- **Formato decimal estándar**: Los precios se exponen y agrupan con dos decimales de precisión, coincidiendo con la representación monetaria establecida en la Constitución del proyecto.

