# Feature Specification: Frontend — Autenticación

**Feature Branch**: `003-frontend-auth`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Funcionalidad de frontend — Autenticación. Los usuarios se registran desde una pantalla de alta con email y contraseña, consumiendo el endpoint POST /auth/register ya implementado. Si el backend rechaza el alta (email duplicado, contraseña débil, campos faltantes), la pantalla muestra el mensaje de error que devuelve el backend, sin reinterpretarlo. El alta no inicia sesión automáticamente, así que un registro exitoso redirige a login, no al área autenticada. Para operar, el usuario inicia sesión por separado desde una pantalla de login con email y contraseña, consumiendo POST /auth/login. Si las credenciales son inválidas, se muestra un único mensaje de error genérico, sin distinguir si falló el email o la contraseña, mismo criterio que ya exige el backend. Un login exitoso guarda el JWT recibido y redirige a una pantalla home autenticada mínima, sin funcionalidad propia todavía. Mientras haya una sesión activa, cualquier pantalla protegida que reciba un 401 del backend redirige a login de forma inmediata. El usuario logueado puede cerrar sesión manualmente desde cualquier pantalla protegida, lo que descarta el JWT guardado y redirige a login. El usuario logueado puede generar una ApiKey desde una pantalla propia de cuenta/configuración, consumiendo POST /auth/api-key. La pantalla muestra la ApiKey en texto plano solo en el momento de la creación, con un aviso de que no se vuelve a mostrar. Si ya existe una ApiKey activa, generar una nueva pide una confirmación explícita antes de invalidarla."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Registro de cuenta nueva (Priority: P1)

Un visitante sin cuenta ingresa a la pantalla de registro, completa su email y contraseña
y crea su cuenta. El sistema valida la información en el servidor; si todo está bien, el
usuario llega a la pantalla de login listo para autenticarse. Si algo falla (email ya
registrado, contraseña débil, campo vacío), la pantalla muestra exactamente el mensaje
que devolvió el servidor, sin traducirlo ni parafrasearlo.

**Why this priority**: Es la puerta de entrada al sistema. Sin registro no hay usuario;
sin usuario no hay login ni ninguna funcionalidad posterior.

**Independent Test**: Abrir la pantalla de registro sin estar autenticado → completar
email y contraseña válidos → verificar redirección a login → intentar de nuevo con email
duplicado y verificar que aparece el mensaje de error del servidor.

**Acceptance Scenarios**:

1. **Given** un visitante en la pantalla de registro con email y contraseña válidos,
   **When** envía el formulario,
   **Then** es redirigido a la pantalla de login (sin iniciar sesión automáticamente).

2. **Given** un visitante en la pantalla de registro con un email ya registrado,
   **When** envía el formulario,
   **Then** la pantalla muestra el mensaje de error exacto devuelto por el servidor (ej. "El email ya está en uso."), sin modificarlo.

3. **Given** un visitante en la pantalla de registro con una contraseña que no cumple los requisitos,
   **When** envía el formulario,
   **Then** la pantalla muestra el mensaje de error exacto devuelto por el servidor, sin modificarlo.

4. **Given** un visitante en la pantalla de registro con campos vacíos o faltantes,
   **When** envía el formulario,
   **Then** la pantalla muestra el mensaje de error exacto devuelto por el servidor.

5. **Given** un visitante en la pantalla de registro,
   **When** un registro exitoso ocurre,
   **Then** NO se inicia sesión automática y NO se redirige al área autenticada; el destino es siempre login.

---

### User Story 2 — Inicio de sesión (Priority: P1)

Un usuario con cuenta accede a la pantalla de login, ingresa sus credenciales y, si son
válidas, queda autenticado y es llevado a la pantalla home. Si las credenciales son
incorrectas, recibe un único mensaje de error genérico que no revela cuál de los dos
campos falló, consistente con la política de seguridad que ya aplica el servidor.

**Why this priority**: Es el acceso a toda la funcionalidad autenticada. Sin login no
se puede operar ni acceder a ninguna pantalla protegida.

**Independent Test**: Acceder a login → ingresar credenciales válidas → verificar
redirección a home autenticado → cerrar sesión → ingresar credenciales incorrectas →
verificar mensaje de error genérico sin distinguir email de contraseña.

**Acceptance Scenarios**:

1. **Given** un usuario con cuenta en la pantalla de login con credenciales correctas,
   **When** envía el formulario,
   **Then** queda autenticado y es redirigido a la pantalla home autenticada.

2. **Given** un usuario con credenciales incorrectas (email inexistente o contraseña errónea),
   **When** envía el formulario de login,
   **Then** se muestra un único mensaje de error genérico, igual en ambos casos, sin revelar si falló el email o la contraseña.

3. **Given** un usuario autenticado en cualquier pantalla protegida,
   **When** el servidor devuelve un 401 (JWT vencido o inválido),
   **Then** es redirigido inmediatamente a login, sin importar en qué pantalla estaba.

4. **Given** un usuario autenticado en cualquier pantalla protegida,
   **When** selecciona "Cerrar sesión",
   **Then** su JWT guardado es descartado y es redirigido a login.

---

### User Story 3 — Generación de ApiKey desde cuenta (Priority: P2)

Un usuario autenticado accede a su pantalla de cuenta/configuración y genera una ApiKey
para uso en integraciones externas. La ApiKey se muestra en texto plano únicamente en
el instante de la creación, acompañada de un aviso explícito de que no volverá a estar
disponible. Si el usuario ya tiene una ApiKey activa y solicita una nueva, el sistema
pide confirmación antes de continuar, dado que la anterior quedará invalidada.

**Why this priority**: La generación de ApiKey es funcionalidad de configuración de
cuenta, posterior y menos frecuente que el flujo de autenticación principal (P1). Se
puede entregar independientemente una vez que el login funciona.

**Independent Test**: Autenticarse → navegar a pantalla de cuenta → generar ApiKey →
verificar que se muestra en texto plano con aviso → generar una segunda ApiKey →
verificar que aparece diálogo de confirmación → confirmar → verificar nueva ApiKey mostrada.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado sin ApiKey activa en la pantalla de cuenta,
   **When** solicita generar una ApiKey,
   **Then** la ApiKey se muestra en texto plano con un aviso de que no se volverá a mostrar, y no se pide confirmación previa.

2. **Given** un usuario autenticado con una ApiKey activa en la pantalla de cuenta,
   **When** solicita generar una nueva ApiKey,
   **Then** aparece un diálogo de confirmación advirtiendo que la ApiKey anterior quedará invalidada.

3. **Given** el diálogo de confirmación visible,
   **When** el usuario cancela,
   **Then** no se genera ninguna ApiKey nueva y la anterior sigue activa.

4. **Given** el diálogo de confirmación visible,
   **When** el usuario confirma,
   **Then** la nueva ApiKey se muestra en texto plano con el aviso de no recuperación, y la anterior queda invalidada.

5. **Given** la ApiKey recién generada mostrada en pantalla,
   **When** el usuario navega fuera de la sección o recarga la página,
   **Then** la ApiKey ya no es visible en ningún lugar de la interfaz.

---

### Edge Cases

- ¿Qué pasa si el servidor está caído o la red falla al enviar el formulario de registro o login?
  → La pantalla muestra un mensaje de error genérico de conectividad; el formulario no queda en estado de carga indefinida.

- ¿Qué pasa si el usuario intenta acceder directamente a una URL protegida sin sesión activa?
  → Es redirigido a login de forma inmediata.

- ¿Qué pasa si el usuario autenticado intenta acceder a la pantalla de login o registro?
  → Es redirigido a home autenticado (no tiene sentido volver a autenticarse).

- ¿Qué pasa si la generación de ApiKey falla en el servidor?
  → La pantalla muestra el mensaje de error devuelto por el servidor, sin parafrasearlo.

- ¿Qué pasa si el JWT guardado ya está vencido cuando el usuario reabre la aplicación?
  → La primera request al servidor que devuelva 401 dispara la redirección a login (el estado se detecta en uso, no al arranque).

## Requirements *(mandatory)*

### Functional Requirements

#### Pantalla de Registro

- **FR-001**: La pantalla de registro MUST presentar campos para email y contraseña.
- **FR-002**: Al enviar el formulario, el sistema MUST invocar el servicio de registro del backend.
- **FR-003**: Si el registro es exitoso, la pantalla MUST redirigir al usuario a la pantalla de login, sin iniciar sesión automáticamente.
- **FR-004**: Si el backend devuelve un error, la pantalla MUST mostrar el mensaje de error exacto devuelto por el servidor, sin modificarlo ni reinterpretarlo.
- **FR-005**: El formulario MUST deshabilitar el botón de envío o mostrar un indicador de carga mientras la petición está en curso, para evitar envíos múltiples.

#### Pantalla de Login

- **FR-006**: La pantalla de login MUST presentar campos para email y contraseña.
- **FR-007**: Al enviar el formulario con credenciales válidas, el sistema MUST guardar el JWT recibido y redirigir al usuario a la pantalla home autenticada.
- **FR-008**: Si las credenciales son inválidas, la pantalla MUST mostrar un único mensaje de error genérico, idéntico independientemente de si falló el email o la contraseña.
- **FR-009**: El formulario de login MUST deshabilitar el botón de envío o mostrar un indicador de carga mientras la petición está en curso.

#### Gestión de sesión y protección de rutas

- **FR-010**: El sistema MUST almacenar el JWT de forma persistente en el cliente para que sobreviva a recargas de página.
- **FR-011**: Toda ruta protegida MUST redirigir a login si no hay JWT activo en el cliente.
- **FR-012**: Si cualquier petición al backend desde una ruta protegida recibe un 401, el sistema MUST descartar el JWT almacenado y redirigir al usuario a login de forma inmediata.
- **FR-013**: El usuario autenticado MUST poder cerrar sesión desde cualquier pantalla protegida, acción que descarta el JWT almacenado y redirige a login.
- **FR-014**: Un usuario autenticado que intente acceder a la pantalla de login o registro MUST ser redirigido a home autenticado.

#### Pantalla de cuenta — Generación de ApiKey

- **FR-015**: La pantalla de cuenta MUST estar disponible únicamente para usuarios autenticados.
- **FR-016**: La pantalla de cuenta MUST ofrecer una acción para generar una nueva ApiKey.
- **FR-017**: Si el usuario no tiene ApiKey activa, la acción MUST generar la ApiKey directamente, sin solicitar confirmación previa.
- **FR-018**: Si el usuario ya tiene una ApiKey activa, la acción MUST mostrar un diálogo de confirmación advirtiendo que la clave anterior quedará invalidada, antes de proceder.
- **FR-019**: Tras una generación exitosa, la pantalla MUST mostrar la ApiKey en texto plano acompañada de un aviso explícito de que no volverá a estar disponible en ningún otro momento ni lugar.
- **FR-020**: La ApiKey mostrada MUST desaparecer de la interfaz en cuanto el usuario navega fuera de esa sección o recarga la página; no debe persistirse ni en localStorage ni en ningún estado que sobreviva a la navegación.
- **FR-021**: Si la generación de ApiKey falla, la pantalla MUST mostrar el mensaje de error devuelto por el servidor.

#### Pantalla home autenticada

- **FR-022**: MUST existir una pantalla home accesible solo para usuarios autenticados, como destino post-login. Su contenido es mínimo y sin funcionalidad propia en esta feature; actúa como placeholder para funcionalidades futuras.

### Key Entities

- **Sesión de usuario**: estado de autenticación activa en el cliente, representada por un JWT con tiempo de vida definido. No tiene representación propia en el frontend más allá del token guardado.
- **ApiKey**: credencial de larga duración generada por el usuario para uso en integraciones externas. En el frontend solo existe como texto plano durante el instante de su creación; no se persiste ni se puede recuperar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo puede completar el registro y llegar a la pantalla de login en menos de 2 minutos desde que abre la aplicación por primera vez.
- **SC-002**: Un usuario registrado puede autenticarse y llegar al home autenticado en menos de 30 segundos desde que abre la pantalla de login.
- **SC-003**: El 100% de las rutas protegidas redirige a login cuando no hay JWT activo, sin excepción medible en tests automatizados.
- **SC-004**: El mensaje de error de login es textualmente idéntico para email inexistente y para contraseña incorrecta, verificable en tests automatizados.
- **SC-005**: La ApiKey no aparece en ningún almacenamiento persistente del cliente (localStorage, sessionStorage, cookies) ni en ningún estado de la aplicación tras salir de la sección de cuenta, verificable inspeccionando el estado y el storage en tests.
- **SC-006**: Un 401 recibido desde cualquier pantalla protegida resulta en redirección a login, verificable en tests automatizados sobre todas las rutas protegidas existentes.

## Design Decisions

### ApiKey en pantalla de cuenta separada, no en el flujo de login

La ApiKey es una credencial de uso posterior y ocasional —pensada para integraciones
programáticas externas, no para la sesión interactiva del usuario—, por lo que no guarda
relación temporal con el acto de iniciar sesión. Incluirla en el flujo de login la
convertiría en un paso obligatorio cada vez que el usuario se autentica, cuando en
realidad el usuario la necesita quizás una sola vez en la vida del proyecto. Separarla
en una pantalla de cuenta/configuración la mantiene accesible sin interrumpir el flujo
principal y deja claro que es una acción de administración de credenciales, no de
autenticación cotidiana.

### Pantalla home autenticada mínima como destino post-login

El destino post-login es hoy una pantalla home autenticada sin funcionalidad propia.
Esta decisión es explícitamente aceptada: la pantalla actúa como placeholder para
funcionalidades futuras (tablero de valuación de jugadores, etc.) que todavía no están
implementadas. El criterio de redirigir ahí permite cerrar el flujo de autenticación de
forma completa y testeable sin bloquear esta feature a la disponibilidad de otras.

## Assumptions

- Los endpoints de backend (`POST /auth/register`, `POST /auth/login`, `POST /auth/api-key`) ya están implementados y en funcionamiento (features 001 y 002 mergeadas).
- El frontend se comunica con el backend exclusivamente a través de clientes de API propios (un módulo por recurso en `frontend/src/service/`), conforme a la Constitución v1.7.0.
- El JWT se almacena en `localStorage` para persistir entre recargas de página. Esta decisión puede revisarse en una feature futura si surgen requisitos de seguridad adicionales (ej. almacenamiento en cookie HttpOnly).
- No existe funcionalidad de recuperación de contraseña; el backend no la tiene implementada.
- No existe listado ni revocación manual de ApiKeys; el backend no los tiene implementados.
- La pantalla home autenticada es un placeholder; su contenido definitivo llegará en features posteriores.
- Las rutas de la aplicación se gestionan con React Router (parte del stack de React 19 + Vite).
- Los mensajes de error del backend llegan en el campo `message` del cuerpo JSON de la respuesta de error.

