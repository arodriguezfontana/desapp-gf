# Feature Specification: Frontend — Portfolio personal

**Feature Branch**: `018-frontend-portfolio`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Funcionalidad de frontend - Portfolio personal. El usuario accede a una vista dedicada para consultar el estado de sus inversiones, consumiendo el endpoint GET /users/:id/portfolio. Esta pantalla es estrictamente privada y requiere que el usuario esté autenticado. Si el usuario intenta acceder sin una sesión activa (sin JWT o con uno vencido/inválido), el sistema lo redirige inmediatamente a la pantalla de login, utilizando el mismo mecanismo de protección de rutas ya establecido. La vista del portfolio se divide en dos secciones principales: Resumen global: Muestra el capital total invertido (calculado en base al precio promedio de compra), el valor actual total de la cartera (basado en la cotización vigente de cada jugador) y la ganancia o pérdida neta acumulada. Detalle de posiciones (Holdings): Un listado o grilla donde cada fila/tarjeta representa la posición del usuario en un jugador específico. Por cada jugador se muestra: nombre, cantidad de tokens poseídos, precio promedio de compra, valor actual del token y la ganancia/pérdida particular de esa posición. Si el portfolio está vacío (el usuario aún no posee tokens), el backend responde con una lista vacía (no un error). En este caso, la vista muestra un estado vacío amigable (por ejemplo, 'Aún no tienes tokens en tu portfolio') acompañado de un botón de llamada a la acción (CTA) que redirige al usuario al catálogo de jugadores para explorar opciones. Decisión de diseño a documentar: La vista de portfolio es de solo lectura y funciona como un 'snapshot' en el momento en que se carga la página. Se decide no implementar un polling (refresco automático en segundo plano) para actualizar los precios en tiempo real. Esto reduce la carga sobre el backend y se alinea con la naturaleza del sistema de cotización, el cual se recalcula mediante un job semanal, haciendo innecesario el refresco continuo por parte del cliente. Riesgo aceptado: Como la cotización de los jugadores depende del recálculo semanal o manual del backend, el 'valor actual' mostrado en el portfolio puede no reflejar el rendimiento exacto en tiempo real del jugador en ese mismo instante de consulta, sino el de la última cotización vigente calculada."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulta de estado y posiciones de inversión (Priority: P1)

Un usuario con sesión activa ingresa a la vista privada de su portfolio para evaluar el rendimiento global de su capital y el detalle de los tokens que posee. En la parte superior visualiza un resumen consolidado con el total de capital invertido, el valor de mercado actual de su cartera y el beneficio o pérdida neta acumulada. Debajo observa una lista o grilla detallada con cada una de sus posiciones de jugadores, visualizando el nombre del futbolista, la cantidad de tokens que posee, su precio promedio de compra, la cotización vigente del token y el resultado financiero específico (ganancia o pérdida) de dicha posición.

**Why this priority**: Constituye la razón de ser de la funcionalidad; le permite al inversor conocer su patrimonio actual en tokens de futbolistas y evaluar el resultado de sus decisiones de compra.

**Independent Test**: Se puede validar iniciando sesión con una cuenta que posee tokens de jugadores, navegando a la pantalla de portfolio y confirmando que se presentan tanto las tarjetas del resumen global con los cálculos consolidados como el listado detallado de posiciones con sus valores correspondientes.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con posiciones activas de tokens, **When** accede a la pantalla de portfolio, **Then** visualiza en el resumen global: el capital total invertido, el valor actual consolidado de su cartera y la ganancia o pérdida neta acumulada.
2. **Given** la visualización del resumen global, **When** la ganancia neta acumulada es positiva, **Then** se destaca con un indicador visual favorable (por ejemplo, color verde y signo positivo); si es negativa, con un indicador desfavorable (por ejemplo, color rojo y signo negativo).
3. **Given** un usuario en la vista de portfolio, **When** consulta la sección de detalle de posiciones (Holdings), **Then** visualiza cada jugador en el que tiene tokens, mostrando: nombre del jugador, cantidad de tokens poseídos, precio promedio de adquisición, cotización actual por token y ganancia o pérdida neta de esa posición particular.
4. **Given** un usuario que permanece en la pantalla de portfolio, **When** transcurre el tiempo sin recargar la página, **Then** los valores permanecen estables como un snapshot obtenido al momento de la carga, sin realizar consultas periódicas en segundo plano (polling).

---

### User Story 2 - Cartera vacía y exploración de jugadores (Priority: P1)

Un usuario autenticado que aún no ha adquirido tokens de ningún jugador accede a la vista de su portfolio. En lugar de encontrar errores o una pantalla en blanco, el sistema le presenta un estado informativo amigable indicando que aún no posee tokens, junto a un botón de llamada a la acción (CTA) que le permite dirigirse inmediatamente al catálogo de jugadores para descubrir opciones y comenzar a operar.

**Why this priority**: Asegura una experiencia de bienvenida comprensible y orientada a la acción para inversores nuevos o sin tenencias, guiándolos hacia el catálogo en lugar de dejarlos ante una interfaz vacía sin rumbo.

**Independent Test**: Se puede validar ingresando con un usuario recién registrado o sin tenencias a la pantalla de portfolio, verificando que se muestra el mensaje de bienvenida a la inversión sin tablas vacías rotas, y comprobando que al pulsar el botón de llamada a la acción el navegador conduce al catálogo de futbolistas.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado sin tokens en cartera, **When** accede a la pantalla de portfolio, **Then** la vista presenta un mensaje amigable indicando que aún no posee tokens en su portfolio (por ejemplo, "Aún no tienes tokens en tu portfolio").
2. **Given** el estado de cartera vacía, **When** el usuario observa la pantalla, **Then** se presenta un botón de acción principal (CTA) con invitación a explorar el catálogo de jugadores.
3. **Given** el botón de llamada a la acción en la cartera vacía, **When** el usuario hace clic sobre él, **Then** es redirigido inmediatamente a la vista del catálogo de jugadores (`/catalog`).

---

### User Story 3 - Restricción de acceso para usuarios no autenticados (Priority: P1)

Un visitante anónimo o un usuario cuya sesión ha caducado o cuyo token de autenticación no es válido intenta acceder de manera directa a la URL del portfolio personal. El sistema intercepta el acceso y lo redirige de inmediato a la pantalla de inicio de sesión, impidiendo la visualización de datos privados y preservando el mecanismo general de rutas protegidas de la aplicación.

**Why this priority**: Protege la privacidad de la información financiera y patrimonial de los usuarios, garantizando que ninguna métrica de inversión sea accesible públicamente.

**Independent Test**: Se puede verificar intentando acceder a la ruta `/portfolio` desde una ventana de navegación privada o habiendo cerrado sesión previamente, corroborando que la interfaz redirige de inmediato a `/login`.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión activa, **When** intenta ingresar a la ruta del portfolio, **Then** el sistema lo redirige inmediatamente a la pantalla de login (`/login`).
2. **Given** un usuario con una sesión expirada o credencial inválida, **When** intenta acceder al portfolio, **Then** es redirigido a la pantalla de login mediante la protección de rutas establecida.

---

### Edge Cases

- **Fallo temporal de comunicación con el servicio**: Si ocurre un error de red o indisponibilidad del servicio al consultar el portfolio, la vista muestra un mensaje de error explicativo claro y un botón para reintentar la carga sin recargar toda la página.
- **Posición con rendimiento neutro (cero ganancia/pérdida)**: Si el valor actual de un token coincide exactamente con su precio promedio de compra, el rendimiento se muestra con formato neutral (sin color de ganancia ni de pérdida y con valor 0.00).
- **Usuario con volumen amplio de posiciones**: Si el usuario posee tokens de decenas de jugadores, la interfaz organiza el listado de forma responsiva y legible, permitiendo el desplazamiento vertical natural sin desbordamientos ni pérdida de visualización del resumen global.
- **Estado de carga inicial**: Mientras se obtiene la información del portfolio desde el servidor, la pantalla exhibe un indicador de carga visible (spinner o esqueleto de contenido) para transmitir respuesta inmediata.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La vista del portfolio personal MUST estar asociada a una ruta privada accesible exclusivamente por usuarios autenticados.
- **FR-002**: Ante cualquier intento de acceso sin sesión activa, con credencial ausente o inválida, el sistema MUST redirigir inmediatamente al usuario a la pantalla de inicio de sesión (`/login`), aplicando el mecanismo estándar de protección de rutas de la aplicación.
- **FR-003**: Al ingresar a la vista, la aplicación MUST consultar el estado de la cartera del usuario autenticado consumiendo el servicio de portfolio (`GET /users/:id/portfolio`) utilizando la identidad del usuario en sesión.
- **FR-004**: La interfaz MUST presentar una sección de Resumen Global que exhiba de forma destacada:
  1. El capital total invertido (calculado como la sumatoria del producto entre la cantidad de tokens y el precio promedio de compra de cada posición).
  2. El valor actual total de la cartera (calculado como la sumatoria del producto entre la cantidad de tokens y la cotización vigente de cada jugador).
  3. La ganancia o pérdida neta acumulada (diferencia entre el valor actual total y el capital total invertido).
- **FR-005**: El valor de ganancia o pérdida neta acumulada del Resumen Global MUST distinguirse visualmente según su signo (indicador positivo para ganancias, negativo para pérdidas y neutral para balance neutro).
- **FR-006**: La interfaz MUST presentar una sección de Detalle de Posiciones (Holdings) donde cada elemento represente la tenencia del usuario en un jugador específico.
- **FR-007**: Por cada posición en la sección de Detalle de Posiciones, la interfaz MUST mostrar:
  1. Nombre completo del jugador.
  2. Cantidad de tokens poseídos por el usuario.
  3. Precio promedio ponderado de compra por token.
  4. Cotización actual vigente del token del jugador.
  5. Ganancia o pérdida neta de la posición (calculada como la diferencia entre el valor actual de los tokens poseídos y el capital invertido en ellos), con indicación visual diferenciada según su signo.
- **FR-008**: Si la consulta de cartera responde con una lista vacía de posiciones (el usuario no posee tokens), la vista MUST presentar un estado vacío amigable con el mensaje textual "Aún no tienes tokens en tu portfolio" (o redacción equivalente clara) y omitir la tabla de posiciones vacía.
- **FR-009**: El estado vacío MUST incluir un botón de llamada a la acción (CTA) que redirija al usuario al catálogo de jugadores (`/catalog`) para explorar alternativas de inversión.
- **FR-010**: La vista de portfolio MUST operar como una instantánea (snapshot) de solo lectura obtenida al momento de la carga de la página, y MUST NOT implementar refresco automático en segundo plano (polling).
- **FR-011**: Mientras se recuperan los datos del portfolio, la interfaz MUST presentar un indicador visual de carga para comunicar el progreso de la consulta.
- **FR-012**: Ante una falla de comunicación o respuesta de error al solicitar el portfolio, la interfaz MUST mostrar un mensaje de error descriptivo con una opción interactiva para reintentar la solicitud.

### Key Entities *(include if feature involves data)*

- **Posición de Cartera (Holding)**: Representa la tenencia de tokens de un jugador particular por parte de un usuario. Contiene: identificador del jugador, nombre del jugador, cantidad de tokens poseídos, precio promedio de compra, cotización vigente del token y resultado neto particular de la posición.
- **Resumen de Cartera (Portfolio Summary)**: Información consolidada del total de inversiones del usuario. Contiene: capital total invertido acumulado, valor actual de mercado de la cartera y ganancia/pérdida neta global.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los intentos de acceso a la pantalla de portfolio por parte de usuarios no autenticados o con credenciales expiradas son redirigidos a la pantalla de login antes de renderizar datos privados.
- **SC-002**: Los usuarios autenticados visualizan el contenido completo del portfolio (resumen global y posiciones o estado vacío) en menos de 2 segundos desde la navegación a la vista bajo condiciones normales de red.
- **SC-003**: En el estado de cartera vacía, el 100% de los usuarios pueden navegar al catálogo de jugadores mediante un único clic en el botón de acción principal.
- **SC-004**: Los importes mostrados en el resumen global coinciden con precisión matemática respecto a la suma de los valores de las posiciones individuales visualizadas en pantalla.
- **SC-005**: Durante la permanencia del usuario en la pantalla de portfolio, la cantidad de peticiones de consulta de cotización en segundo plano es cero (ausencia de polling).

## Assumptions

- La ruta designada para la vista dentro de la navegación de la aplicación es `/portfolio`.
- El identificador del usuario autenticado (`:id`) se obtiene a partir de la sesión activa del usuario almacenada en el cliente web.
- La aplicación ya cuenta con un componente o mecanismo de protección de rutas (`ProtectedRoute`) y un cliente HTTP que inyecta automáticamente el token JWT en las peticiones que requieren autenticación.
- Todos los valores monetarios se formatean con dos cifras decimales conforme al estándar de presentación de precios y cotizaciones del sistema.
- El catálogo de jugadores se encuentra disponible en la ruta `/catalog`.

## Design Decisions

- **DD-001 — Visualización en snapshot de solo lectura sin polling en segundo plano**:
  Se decide que la vista de portfolio opere como un snapshot estático al momento de cargar la pantalla y no efectúe consultas periódicas automáticas (polling) hacia el backend.
  *Justificación*: Las cotizaciones de los futbolistas en la plataforma son recalculadas mediante procesos semanales o manuales programados en el backend, por lo que su valor no experimenta cambios segundo a segundo. Evitar el polling elimina tráfico y carga innecesaria sobre los servidores y optimiza el consumo de recursos en el navegador del cliente.

## Accepted Risks

- **AR-001 — Cotización basada en el último cálculo disponible del backend**:
  El valor actual y las ganancias/pérdidas exhibidas en la cartera dependen del último recálculo de cotización efectuado por el sistema. Por lo tanto, el "valor actual" refleja la cotización oficial vigente más reciente y no necesariamente el rendimiento minuto a minuto del jugador en tiempo real.

