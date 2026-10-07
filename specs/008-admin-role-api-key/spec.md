# Feature Specification: Rol de usuario (admin / user) y rol copiado en la ApiKey

**Feature Branch**: `[sin rama asignada]`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Ampliación de la funcionalidad de autenticación y de emisión de ApiKey. El Usuario suma un campo rol, que puede ser admin o user, con user como valor por default. No existe ningún endpoint para cambiar el rol de otro usuario. El primer usuario admin se crea con un seed idempotente al arrancar la aplicación, a partir de las variables de entorno ADMIN_EMAIL y ADMIN_PASSWORD: si ese usuario ya existe, no se vuelve a crear ni se le resetea la contraseña en cada arranque. Cuando un usuario emite una ApiKey (POST /auth/api-key), la clave guarda el rol de quien la emitió en el momento de la emisión, no lo vuelve a consultar contra el Usuario en cada request que llega con esa clave. Las ApiKeys que ya existían antes de este cambio quedan con rol user por default."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Todo usuario nuevo nace con rol user (Priority: P1)

Cuando una persona se registra en la plataforma, su cuenta queda con el rol `user`, sin que tenga que indicarlo. Ninguna persona que se registra puede elegir ni declarar un rol distinto de `user`.

**Why this priority**: Es el punto de partida de todo el modelo de roles. Si una cuenta nueva pudiera nacer como `admin`, el control de privilegios quedaría abierto al público.

**Independent Test**: Se puede probar registrando un usuario nuevo (con y sin campo de rol en el pedido) y verificando que la cuenta resultante tiene rol `user`.

**Acceptance Scenarios**:

1. **Given** una persona que no tiene cuenta, **When** se registra sin indicar ningún rol, **Then** la cuenta creada tiene rol `user`.
2. **Given** una persona que no tiene cuenta, **When** se registra e intenta indicar `admin` como rol en el pedido, **Then** la cuenta creada tiene rol `user` y el valor enviado no se aplica.

---

### User Story 2 - El primer admin se crea al arrancar, sin duplicarse ni resetearse (Priority: P1)

Al arrancar la aplicación, si las variables de entorno `ADMIN_EMAIL` y `ADMIN_PASSWORD` están definidas, el sistema garantiza que exista un usuario con ese correo y rol `admin`. Si ese usuario ya existe, el arranque no lo vuelve a crear, no cambia su contraseña y no altera sus datos. El mismo arranque puede repetirse cuantas veces haga falta sin efectos adicionales.

**Why this priority**: Sin un primer admin no existe ninguna forma de operar con privilegios en el sistema, dado que no hay endpoint para asignar roles. Y un seed que resetee la contraseña en cada arranque permitiría que cualquiera que conozca la variable de entorno tome control de la cuenta cada vez que el servicio reinicie.

**Independent Test**: Se puede probar arrancando la aplicación dos veces con las mismas variables: la primera crea el admin; la segunda no crea otro, no cambia la contraseña del existente y no modifica su registro. Se puede probar además cambiando la contraseña del admin manualmente y verificando que un nuevo arranque no la revierte.

**Acceptance Scenarios**:

1. **Given** que no existe ningún usuario con el correo `ADMIN_EMAIL` y las variables están definidas, **When** la aplicación arranca, **Then** se crea un usuario con ese correo, con rol `admin` y con la contraseña `ADMIN_PASSWORD` almacenada de forma no recuperable.
2. **Given** que ya existe un usuario admin creado por el seed, **When** la aplicación arranca de nuevo con las mismas variables, **Then** no se crea un segundo usuario, la contraseña existente no cambia y el rol no cambia.
3. **Given** que la contraseña del admin fue cambiada después de su creación, **When** la aplicación arranca de nuevo con `ADMIN_PASSWORD` con el valor original, **Then** la contraseña cambiada sigue vigente (el arranque no la resetea).
4. **Given** que ya existe un usuario con el correo `ADMIN_EMAIL` pero con rol `user`, **When** la aplicación arranca, **Then** ese usuario no se crea de nuevo, su contraseña no cambia y su rol no se modifica (ver Assumptions).
5. **Given** que `ADMIN_EMAIL` o `ADMIN_PASSWORD` no están definidas, **When** la aplicación arranca, **Then** el seed no crea ningún usuario, la aplicación arranca igual y deja un aviso en el registro de arranque que indica que el seed fue omitido.

---

### User Story 3 - La ApiKey guarda el rol de quien la emitió (Priority: P1)

Cuando un usuario autenticado pide una ApiKey (POST `/auth/api-key`), la clave emitida queda asociada al rol que el usuario tiene en ese momento. Desde entonces, cualquier operación que se autorice con esa clave usa el rol guardado en la clave; el sistema no vuelve a consultar el rol del Usuario en cada request que llega con esa clave.

**Why this priority**: Es la parte del cambio que define cómo se autoriza una operación hecha con ApiKey. Sin este rol copiado, la ApiKey no puede decidir por sí sola qué puede hacer.

**Independent Test**: Se puede probar emitiendo una ApiKey con un usuario `user` y otra con un usuario `admin`, y verificando que cada clave conserva el rol de su emisor. Se puede probar además cambiando el rol del emisor después de emitir y verificando que la clave ya emitida conserva el rol original hasta que se rote.

**Acceptance Scenarios**:

1. **Given** un usuario con rol `user` autenticado con JWT, **When** pide una ApiKey, **Then** la ApiKey emitida queda registrada con rol `user`.
2. **Given** un usuario con rol `admin` autenticado con JWT, **When** pide una ApiKey, **Then** la ApiKey emitida queda registrada con rol `admin`.
3. **Given** una ApiKey emitida con rol `user`, **When** esa clave se usa en una request, **Then** el rol que se considera para autorizar la operación es `user`, sin consultar el rol actual del Usuario emisor.
4. **Given** un usuario con una ApiKey ya emitida con rol `user`, **When** su rol cambia a `admin` después de la emisión, **Then** la ApiKey existente sigue teniendo rol `user` (no se actualiza de forma retroactiva) hasta que el usuario pida una nueva ApiKey.
5. **Given** un usuario con una ApiKey emitida, **When** pide una nueva ApiKey (rotación), **Then** la nueva clave tiene el rol vigente del usuario en ese momento y la anterior queda invalidada según lo ya definido en `002-api-key-issuance`.

---

### User Story 4 - ApiKeys anteriores al cambio quedan como user (Priority: P2)

Las ApiKeys que existían antes de incorporar el rol siguen siendo válidas y quedan con rol `user`, que es el valor por default. No se invalida ninguna clave existente por este cambio.

**Why this priority**: Evita cortar el acceso de los integradores existentes, pero les asigna el nivel de privilegio más bajo, de modo que el cambio no amplía lo que ya podían hacer.

**Independent Test**: Se puede probar con datos previos al cambio: después de aplicar el cambio, una ApiKey emitida antes sigue autenticando y su rol efectivo es `user`.

**Acceptance Scenarios**:

1. **Given** una ApiKey emitida antes de este cambio, **When** se aplica el cambio, **Then** la clave sigue siendo válida y figura con rol `user`.
2. **Given** una ApiKey emitida antes de este cambio, **When** se usa en una request después del cambio, **Then** la request se procesa con rol `user`.

---

### Edge Cases

- **Valor de rol inválido**: Cualquier valor de rol distinto de `admin` o `user` (por ejemplo `superadmin` o una cadena vacía) MUST ser rechazado y nunca persistirse.
- **Usuario admin que pide una ApiKey tras haber sido degradado a user**: Si el rol cambia a `user` (por un cambio directo en la base de datos), la siguiente ApiKey que emita tiene rol `user`, y la clave previa conserva `admin` hasta su rotación.
- **Primer arranque sin ningún admin y sin variables**: La aplicación arranca normalmente, sin admin. El sistema no bloquea el arranque por esta razón.
- **ADMIN_EMAIL con formato inválido**: El seed MUST no crear el usuario y dejar un aviso en el arranque; la aplicación sigue arrancando.
- **Arranques concurrentes (dos instancias que arrancan a la vez con las mismas variables)**: El resultado MUST ser exactamente un usuario con ese correo; ninguna de las dos instancias falla de forma que impida el arranque.
- **ADMIN_PASSWORD que no cumple la política de contraseña**: El seed MUST rechazar la creación con un aviso de arranque y no crear el usuario. Si el usuario ya existe, esta validación no se aplica porque el seed no lo toca.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada usuario MUST tener exactamente un rol, que puede ser `admin` o `user`.
- **FR-002**: Cuando un usuario se registra sin indicar rol, el sistema MUST asignarle el rol `user`.
- **FR-003**: El alta de usuario MUST NOT permitir que quien se registra determine su propio rol: cualquier rol enviado en el pedido de registro MUST ser rechazado con 400 por la validación global de DTO (`forbidNonWhitelisted`), porque el alta no declara ese campo. La cuenta no se crea.
- **FR-004**: El sistema MUST NOT exponer ningún endpoint ni operación para cambiar el rol de otro usuario.
- **FR-005**: Al arrancar, si `ADMIN_EMAIL` y `ADMIN_PASSWORD` están definidas, el sistema MUST asegurar que exista un usuario con ese correo y rol `admin`, de forma idempotente.
- **FR-006**: Si ya existe un usuario con el correo `ADMIN_EMAIL`, el seed MUST NOT crear otro usuario, MUST NOT modificar su contraseña y MUST NOT modificar su rol.
- **FR-007**: La contraseña del admin creado por el seed MUST almacenarse con el mismo tratamiento de hasheo irreversible que cualquier otra contraseña del sistema; `ADMIN_PASSWORD` MUST NOT persistirse ni registrarse en texto plano en ninguna capa.
- **FR-008**: Si `ADMIN_EMAIL` o `ADMIN_PASSWORD` no están definidas, el seed MUST omitirse sin impedir el arranque de la aplicación, dejando un aviso en el registro de arranque.
- **FR-009**: Cuando un usuario autenticado emite una ApiKey mediante POST `/auth/api-key`, la ApiKey MUST registrar el rol que ese usuario tiene en el momento de la emisión.
- **FR-010**: Al autorizar una operación con una ApiKey, el sistema MUST usar el rol registrado en la propia ApiKey y MUST NOT consultar el rol actual del Usuario emisor en cada request.
- **FR-011**: Un cambio posterior en el rol de un usuario MUST NOT modificar el rol de las ApiKeys que ya emitió; esas claves conservan el rol original hasta que se roten.
- **FR-012**: Una nueva emisión de ApiKey (rotación) MUST tomar el rol vigente del usuario en ese momento, e invalidar la clave anterior según lo definido en `002-api-key-issuance`.
- **FR-013**: Las ApiKeys emitidas antes de incorporar el rol MUST quedar con rol `user` y MUST seguir siendo válidas.
- **FR-014**: El sistema MUST rechazar cualquier valor de rol distinto de `admin` o `user`.
- **FR-015**: Los errores de seed (variables ausentes, formato inválido, contraseña que no cumple la política) MUST informarse en el registro de arranque sin exponer el valor de `ADMIN_PASSWORD`.

### Key Entities *(include if feature involves data)*

- **Usuario (User)**: Cuenta de la plataforma. Atributos conceptuales nuevos: **rol** (`admin` o `user`, default `user`). Es la fuente de verdad del rol para nuevas emisiones de ApiKey.
- **ApiKey**: Credencial técnica asociada a un usuario. Atributo conceptual nuevo: **rol copiado** (`admin` o `user`), fijado en el momento de la emisión y que no cambia después.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las cuentas creadas por registro público tienen rol `user`, independientemente de lo que se envíe en el pedido.
- **SC-002**: Tras N arranques consecutivos de la aplicación con las mismas variables de admin, existe exactamente una cuenta con el correo `ADMIN_EMAIL`, y su contraseña y rol no cambian respecto del primer arranque.
- **SC-003**: El 100% de las ApiKeys emitidas por un usuario reflejan el rol que ese usuario tenía al momento de la emisión.
- **SC-004**: En el 100% de los casos en que el rol de un usuario cambia después de emitir una ApiKey, esa clave conserva el rol original hasta su rotación.
- **SC-005**: El 100% de las ApiKeys emitidas antes de este cambio siguen autenticando y figuran con rol `user`.
- **SC-006**: Exactamente 0 ocurrencias de la contraseña de admin en texto plano en registros de arranque, respuestas o almacenamiento.

## Assumptions

- Las features `001-user-auth` (registro, login, JWT) y `002-api-key-issuance` (emisión, rotación e invalidación de ApiKey) están operativas; esta spec amplía ambas sin reemplazarlas.
- El rol se incorpora en esta feature como dato y como regla de copia. **Esta feature no define ninguna operación exclusiva de admin**: qué puede hacer un admin que un user no pueda queda para features posteriores. Hasta entonces, el rol existe y se copia, pero no cambia por sí solo qué endpoints responden.
- Si `ADMIN_EMAIL` corresponde a un usuario existente con rol `user`, el seed **no lo promueve** a admin. Se asume que promover a una cuenta existente es un cambio de rol que requiere acceso directo a la base de datos (ver riesgos aceptados), y que el seed sólo garantiza la existencia del primer admin cuando el correo no está tomado. Si la cátedra prefiere lo contrario, es un cambio de una sola regla en FR-006.
- Cuando no hay variables de admin definidas, la aplicación arranca sin admin. No se considera error de arranque.
- La política de contraseña que aplica al registro público también aplica a `ADMIN_PASSWORD` al momento de crear el admin.
- La ApiKey no tiene expiración por tiempo; su vigencia sigue las reglas de `002-api-key-issuance`.
- Las ApiKeys existentes se migran con rol `user` por default, sin reemisión.

## Decisiones de diseño

### Por qué el rol se copia a la ApiKey en el momento de emitirla

El rol se copia a la ApiKey al emitirla, en lugar de consultarse contra el Usuario en cada request, por el mismo criterio que ya rige para la ApiKey en el resto del sistema: la ApiKey tiene que alcanzarse a sí misma para autorizar una operación, sin depender de una consulta adicional a quién la pidió. Hoy el guard de ApiKey resuelve la clave buscando su hash en la tabla de ApiKeys y comprobando que esté activa; no toca la tabla de usuarios. Mantener ese mismo patrón para el rol significa que la autorización de una request con ApiKey depende sólo de la propia credencial, no de un segundo lookup sobre el usuario emisor.

Consecuencias de esta decisión:

- La autorización con ApiKey es una sola lectura, y su resultado queda determinado por la clave misma.
- El rol de una ApiKey no es una propiedad del usuario en tiempo real: es una propiedad de la credencial, fijada en el momento de la emisión. Esto es lo que habilita el riesgo aceptado descrito abajo.
- Para cambiar el rol efectivo de una ApiKey existente hace falta rotarla (emitir una nueva), que es el mecanismo que ya existe para reemplazar claves.

### Por qué el seed es idempotente y no resetea la contraseña

El seed corre en cada arranque, por lo que su comportamiento con un usuario ya existente es parte de la seguridad: si resetea la contraseña, la variable de entorno pasa a ser una contraseña permanente que cualquiera con acceso a ese entorno puede usar para recuperar la cuenta en cada reinicio. Por eso el seed sólo crea cuando el correo no existe.

## Riesgos aceptados

- **Cambio de rol no retroactivo sobre ApiKeys ya emitidas**: si el rol de un usuario cambia después de haber emitido una ApiKey, esa clave conserva el rol que tenía al momento de emitirse hasta que se rote. No se actualiza retroactivamente. Mientras la clave no se rote, un usuario degradado puede seguir operando con los privilegios de su clave vieja; y un usuario promovido no obtiene privilegios con una clave emitida antes de la promoción. Se acepta porque es consecuencia directa de copiar el rol a la ApiKey, y el mecanismo de mitigación es la rotación, que ya existe.
- **Sin forma de promover a un segundo admin sin acceso directo a la base de datos**: no existe endpoint para cambiar roles en este alcance. Promover o degradar cuentas requiere una modificación directa en la base de datos. Se acepta porque el alcance de esta feature excluye explícitamente cualquier endpoint de administración de roles, y el único admin garantizado es el del seed.
