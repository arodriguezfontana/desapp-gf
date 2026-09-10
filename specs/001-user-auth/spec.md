# Feature Specification: Autenticación de usuarios (alta, login y protección de endpoints con JWT)

**Feature Branch**: `feat/auth`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Funcionalidad de autenticación. Los usuarios se registran con email y contraseña. La contraseña tiene que tener entre 8 y 16 caracteres, con al menos una mayúscula, una minúscula, un número y un carácter especial. Si el email ya está registrado, rechazá el alta. El alta no inicia sesión automáticamente: crea la cuenta nada más, sin devolver ningún token. Para operar en el sistema, el usuario inicia sesión por separado con su email y contraseña. Si son correctos, el sistema le devuelve un JWT. Si el email no existe o la contraseña no coincide, la respuesta tiene que ser la misma en ambos casos, para no revelar qué emails están registrados. El JWT emitido expira a las 24 horas. El resto de los endpoints del sistema exige ese JWT para identificar quién está operando, salvo el alta y el login, que quedan exentos. Sin JWT, con uno inválido o vencido, el endpoint tiene que rechazar la operación. La entidad principal es el Usuario, con email único y contraseña hasheada. Documentá como decisión de diseño por qué se eligió JWT y no ApiKey. Dejá explícito como riesgo aceptado que la revocación de un JWT filtrado antes de su expiración natural queda fuera de alcance."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alta de cuenta (Priority: P1)

Una persona que todavía no tiene cuenta se registra en la plataforma indicando su email y una contraseña. El sistema crea la cuenta y la deja lista para poder iniciar sesión más tarde. El alta no abre sesión ni entrega credenciales de acceso: solo deja la cuenta creada.

**Why this priority**: Sin alta no puede existir ningún usuario en el sistema; es el punto de entrada de toda la funcionalidad de la plataforma.

**Independent Test**: Se puede probar de forma aislada enviando un alta con datos válidos y verificando que la cuenta queda registrada, que la respuesta no incluye ningún token ni sesión, y que un segundo intento con el mismo email es rechazado.

**Acceptance Scenarios**:

1. **Given** un email que no está registrado y una contraseña que cumple la política, **When** la persona solicita el alta, **Then** el sistema crea la cuenta y responde con éxito sin devolver ningún token ni abrir sesión.
2. **Given** un email que ya está registrado, **When** alguien solicita el alta con ese email, **Then** el sistema rechaza el alta e informa que el email ya está en uso, y no modifica la cuenta existente.
3. **Given** una contraseña que no cumple la política (longitud fuera de 8–16, o falta mayúscula, minúscula, número o carácter especial), **When** la persona solicita el alta, **Then** el sistema rechaza el alta e informa que la contraseña no cumple los requisitos, y no crea ninguna cuenta.
4. **Given** un alta creada con éxito, **When** se inspecciona lo almacenado, **Then** la contraseña figura hasheada y nunca en texto plano.

---

### User Story 2 - Inicio de sesión y obtención del JWT (Priority: P1)

Un usuario que ya tiene cuenta inicia sesión con su email y contraseña en un endpoint dedicado, independiente del alta. Si las credenciales son correctas, recibe un JWT que le sirve para operar en el resto del sistema durante las próximas 24 horas.

**Why this priority**: Es la única vía para obtener la credencial que habilita todas las operaciones del sistema; sin login, una cuenta creada no puede hacer nada.

**Independent Test**: Se puede probar de forma aislada creando una cuenta, iniciando sesión con las credenciales correctas y verificando que se recibe un JWT válido por 24 horas; y verificando que credenciales incorrectas y emails inexistentes producen exactamente la misma respuesta de rechazo.

**Acceptance Scenarios**:

1. **Given** una cuenta existente y credenciales correctas, **When** el usuario inicia sesión, **Then** el sistema responde con éxito y entrega un JWT que identifica a ese usuario.
2. **Given** un JWT recién emitido por un login exitoso, **When** se inspecciona su vencimiento, **Then** expira exactamente 24 horas después de su emisión.
3. **Given** un email que no corresponde a ninguna cuenta, **When** se intenta iniciar sesión, **Then** el sistema responde con un rechazo genérico de credenciales inválidas, sin indicar que el email no existe.
4. **Given** un email que sí corresponde a una cuenta pero con contraseña incorrecta, **When** se intenta iniciar sesión, **Then** el sistema responde con un rechazo idéntico —mismo código de estado y mismo mensaje— al del caso de email inexistente.
5. **Given** un login exitoso, **When** se observa la respuesta, **Then** no se filtra ningún dato del usuario más allá de lo necesario para operar, y la contraseña nunca aparece en la respuesta ni en logs.

---

### User Story 3 - Acceso a endpoints protegidos con el JWT (Priority: P1)

Cualquier endpoint del sistema que necesite saber qué usuario está operando (por ejemplo comprar o vender tokens, o ver el propio portfolio) exige un JWT válido. El alta y el login son las únicas operaciones exentas. Una petición sin JWT, con un JWT inválido o con uno vencido es rechazada antes de ejecutar la operación.

**Why this priority**: Es la razón de ser de la autenticación: garantizar que toda operación sensible se atribuya a un usuario identificado y que nadie opere de forma anónima.

**Independent Test**: Se puede probar de forma aislada llamando a un endpoint protegido de ejemplo con: (a) un JWT válido y verificando que la operación se atribuye al usuario correcto; (b) sin JWT, con un JWT malformado y con un JWT vencido, verificando que todas se rechazan sin ejecutar la operación.

**Acceptance Scenarios**:

1. **Given** un JWT válido y no vencido, **When** el usuario llama a un endpoint protegido, **Then** el sistema identifica al usuario dueño del token y ejecuta la operación en su nombre.
2. **Given** una petición a un endpoint protegido sin ningún JWT, **When** llega al sistema, **Then** es rechazada con un error de no autenticado y la operación no se ejecuta.
3. **Given** un JWT malformado, con firma inválida o alterado, **When** se usa contra un endpoint protegido, **Then** la petición es rechazada con un error de no autenticado y la operación no se ejecuta.
4. **Given** un JWT que ya pasó sus 24 horas de vida, **When** se usa contra un endpoint protegido, **Then** la petición es rechazada con un error de no autenticado y la operación no se ejecuta.
5. **Given** una petición de alta o de login, **When** llega sin JWT, **Then** se procesa normalmente porque ambas están exentas.

---

### Edge Cases

- **Email con distinta capitalización o espacios**: `Ana@Mail.com` y `ana@mail.com ` se consideran el mismo email; el sistema normaliza (recorta espacios y baja a minúsculas) antes de comparar unicidad y antes de buscar en login, de modo que no puedan coexistir dos cuentas para el mismo email real.
- **Email con formato inválido** (sin `@`, sin dominio): el alta se rechaza por formato antes de evaluar unicidad.
- **Contraseña en el límite**: 8 y 16 caracteres son válidos; 7 y 17 no.
- **Carácter especial**: cualquier carácter que no sea letra ni dígito cuenta como especial (incluye espacio interior, símbolos y puntuación).
- **Alta concurrente con el mismo email**: si dos altas del mismo email llegan casi simultáneamente, a lo sumo una crea la cuenta; la otra es rechazada por email en uso.
- **Login con campos vacíos o faltantes**: se rechaza con el mismo error genérico de credenciales inválidas (o error de forma si falta el campo), sin revelar si el email existe.
- **JWT válido de un usuario cuya cuenta ya no existe**: la operación se rechaza como no autenticada.
- **Header de autorización presente pero vacío o sin el esquema esperado**: se trata como ausencia de JWT y se rechaza.
- **Reloj**: el vencimiento se evalúa contra la hora del servidor; un token en el instante exacto de expiración se considera vencido.

## Requirements *(mandatory)*

### Functional Requirements

#### Alta de usuario

- **FR-001**: El sistema MUST permitir crear una cuenta a partir de un email y una contraseña.
- **FR-002**: El sistema MUST rechazar el alta si el email ya corresponde a una cuenta existente, informando que el email está en uso, sin modificar la cuenta previa.
- **FR-003**: El sistema MUST validar que la contraseña tenga entre 8 y 16 caracteres inclusive y contenga al menos una letra mayúscula, una letra minúscula, un dígito y un carácter especial (cualquier carácter que no sea letra ni dígito); si no cumple, MUST rechazar el alta indicando el incumplimiento.
- **FR-004**: El sistema MUST validar que el email tenga un formato válido antes de aceptar el alta.
- **FR-005**: El sistema MUST normalizar el email (recorte de espacios y minúsculas) antes de evaluar unicidad y antes de persistirlo.
- **FR-006**: El alta MUST NOT iniciar sesión ni devolver ningún token ni credencial de acceso; su única salida es la confirmación de que la cuenta fue creada.
- **FR-007**: El sistema MUST almacenar la contraseña únicamente en forma hasheada y MUST NOT almacenarla, loguearla ni devolverla en texto plano en ninguna capa.
- **FR-008**: El sistema MUST garantizar que no puedan coexistir dos cuentas con el mismo email normalizado, incluso ante solicitudes concurrentes.

#### Inicio de sesión

- **FR-009**: El sistema MUST ofrecer una operación de inicio de sesión separada e independiente del alta, que recibe email y contraseña.
- **FR-010**: Ante credenciales correctas, el sistema MUST emitir un JWT que identifique de forma inequívoca al usuario autenticado.
- **FR-011**: El JWT emitido MUST expirar 24 horas después de su emisión.
- **FR-012**: Si el email no corresponde a ninguna cuenta o la contraseña no coincide, el sistema MUST responder con un rechazo idéntico en ambos casos —mismo código de estado y mismo mensaje— sin revelar cuál de las dos condiciones falló ni si el email está registrado.
- **FR-013**: El inicio de sesión MUST NOT requerir un JWT previo.
- **FR-014**: La respuesta de login MUST NOT incluir la contraseña ni datos del usuario que no sean necesarios para operar.

#### Protección de endpoints

- **FR-015**: Todo endpoint del sistema que necesite identificar al usuario que opera MUST exigir un JWT válido y vigente.
- **FR-016**: El alta de usuario y el inicio de sesión MUST ser las únicas operaciones exentas de presentar un JWT.
- **FR-017**: El sistema MUST rechazar, con un error de no autenticado y sin ejecutar la operación, toda petición a un endpoint protegido que llegue sin JWT, con un JWT malformado, con firma inválida, alterado, o vencido.
- **FR-018**: Ante un JWT válido, el sistema MUST poner a disposición de la operación la identidad del usuario dueño del token, de modo que la operación quede atribuida a él.
- **FR-019**: Si el JWT es válido en forma pero el usuario que identifica ya no existe, el sistema MUST rechazar la petición como no autenticada.

#### Manejo de errores y consistencia

- **FR-020**: Las respuestas de error de esta funcionalidad MUST seguir el formato de error único del sistema, con el código de estado correcto (por ejemplo: forma inválida del request, email en uso, credenciales inválidas, no autenticado) y sin filtrar stack traces ni mensajes internos.

### Decisiones de diseño

- **DD-001 — JWT en lugar de ApiKey**: Se elige JWT como mecanismo de autenticación de esta funcionalidad. La cátedra aclaró que JWT y ApiKey son mecanismos distintos para casos de uso distintos. Acá el caso de uso es identificar a un **usuario individual** que realiza operaciones personales —comprar/vender tokens, ver el propio portfolio—, donde cada request debe atribuirse a una persona concreta y su sesión debe poder vencer y renovarse mediante un nuevo login sin volver a registrarse: ese es el caso de uso de JWT. ApiKey apunta a identificar **aplicaciones o integraciones** con acceso programático de larga duración, no personas, y no aporta la noción de sesión con vencimiento que se necesita acá. Por eso **ApiKey queda explícitamente fuera del alcance** de esta funcionalidad.

### Riesgos aceptados

- **RA-001 — No hay revocación anticipada de JWT**: Un JWT emitido es válido hasta su expiración natural a las 24 horas. Si un JWT se filtra, no existe en el alcance de esta funcionalidad ningún mecanismo (lista de revocación, invalidación por cambio de contraseña, cierre de sesión del lado servidor, rotación de secreto dirigida) para invalidarlo antes de que venza. Se acepta este riesgo: la ventana de exposición está acotada a 24 horas por el vencimiento del token, y la constitución ya define ese vencimiento como la mitigación prevista. Cualquier mecanismo de revocación anticipada es trabajo futuro fuera de esta spec.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona con acceso a la plataforma. Atributos: identificador propio, email (único, normalizado a minúsculas y sin espacios de borde), contraseña almacenada hasheada, fecha de creación. Relaciones: es el actor al que se atribuyen las operaciones del resto del sistema (compra/venta de tokens, portfolio); esas relaciones se definen en sus respectivas specs.
- **JWT emitido**: credencial temporal producida por un login exitoso. No se persiste en el sistema. Porta la identidad del usuario y un instante de expiración fijado 24 horas después de la emisión. Es la prueba que los endpoints protegidos exigen para atribuir una operación a un usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los altas con email nuevo y contraseña que cumple la política resultan en una cuenta creada y en cero tokens o sesiones devueltas.
- **SC-002**: El 100% de los altas con un email ya registrado son rechazados y no alteran la cuenta existente.
- **SC-003**: El 100% de las contraseñas que incumplen cualquiera de las reglas (longitud 8–16, mayúscula, minúscula, número, carácter especial) son rechazadas en el alta; el 100% de las que cumplen las cuatro reglas y la longitud son aceptadas.
- **SC-004**: En el login fallido, la respuesta para "email inexistente" y para "contraseña incorrecta" es indistinguible: mismo código de estado y mismo cuerpo en el 100% de los casos, verificado por prueba automatizada.
- **SC-005**: El 100% de los JWT emitidos dejan de ser aceptados por los endpoints protegidos una vez transcurridas 24 horas desde su emisión.
- **SC-006**: El 100% de las peticiones a un endpoint protegido sin JWT, con JWT malformado o con JWT vencido son rechazadas sin ejecutar la operación.
- **SC-007**: El 100% de las peticiones a un endpoint protegido con JWT válido quedan atribuidas al usuario correcto.
- **SC-008**: En ninguna respuesta ni registro de log del sistema aparece una contraseña en texto plano ni el hash de una contraseña, verificado por revisión e inspección de logs de las pruebas.
- **SC-009**: El alta y el login siguen siendo accesibles sin JWT en el 100% de los casos.
- **SC-010**: La spec deja documentadas y localizables la decisión de diseño JWT-vs-ApiKey (DD-001) y el riesgo aceptado de no revocación anticipada (RA-001).

## Assumptions

- El vencimiento del JWT es exactamente 24 horas, tomado como ventana fija desde la emisión (la constitución exige un vencimiento definido y deja el valor a esta spec; el enunciado fija 24 horas).
- El email se trata de forma insensible a mayúsculas/minúsculas y se normaliza recortando espacios de borde; no se admite alias por "+" ni normalización específica de proveedores de correo (Gmail, etc.) en esta versión.
- No hay verificación de email (no se envía correo de confirmación) en el alta; la cuenta queda activa inmediatamente. La verificación de email es trabajo futuro fuera de alcance.
- No hay recuperación ni cambio de contraseña, ni cierre de sesión del lado servidor, ni "recordarme", ni refresh tokens en esta funcionalidad; renovar la sesión se hace volviendo a iniciar sesión.
- No hay roles ni permisos diferenciados: todo usuario autenticado tiene el mismo nivel de acceso a los endpoints protegidos; la autorización fina por operación se define en las specs de esas operaciones.
- No hay límite de intentos de login (rate limiting / bloqueo por fuerza bruta) en el alcance de esta funcionalidad; se considera endurecimiento futuro.
- El "carácter especial" de la contraseña es cualquier carácter que no sea `[A-Za-z0-9]`.
- El transporte seguro (HTTPS) y la gestión del secreto de firma del JWT son responsabilidad de la configuración de despliegue, no de esta spec.
- Los endpoints protegidos concretos (compra/venta de tokens, portfolio) se implementan en sus propias features; esta spec solo define el contrato de que exigen un JWT válido y cómo se comporta el rechazo.
