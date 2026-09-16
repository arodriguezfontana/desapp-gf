# Feature Specification: Emisión de ApiKey para usuario autenticado

**Feature Branch**: `feat/api-key-issuance`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Emisión de ApiKey. El sistema debe exponer un endpoint que genere una ApiKey nueva para el usuario autenticado (POST), requiriendo un JWT válido para llamarlo, no se puede pedir una ApiKey sin estar logueado. Cada usuario tiene como máximo una ApiKey activa a la vez: si ya tenía una y pide una nueva, la anterior queda invalidada (deja de servir para autenticarse). No hace falta un endpoint para listar ni revocar ApiKeys. La ApiKey se muestra en texto plano únicamente en la respuesta de este endpoint, en el momento en que se genera; no se persiste en texto plano en la base (se guarda hasheada, igual que la contraseña), y no hay forma de volver a consultar su valor una vez generada, si el usuario la pierde, tiene que generar una nueva, invalidando la vieja."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Emisión inicial de ApiKey para usuario autenticado (Priority: P1)

Un usuario con una cuenta activa y sesión iniciada (autenticado mediante JWT) solicita por primera vez la generación de una ApiKey para poder interactuar programáticamente con el sistema. El sistema genera una nueva clave secreta con alta entropía, persiste únicamente su versión hasheada asociada al usuario, y devuelve la clave en texto plano en la respuesta de la petición, advirtiendo al usuario que es la única oportunidad para visualizarla y guardarla.

**Why this priority**: Es la funcionalidad central requerida; sin este flujo no es posible emitir credenciales de tipo ApiKey en el sistema.

**Independent Test**: Se puede probar de forma aislada iniciando sesión con un usuario, invocando el endpoint de emisión con el JWT obtenido y verificando que:
1. La respuesta es exitosa (HTTP 201) y contiene la ApiKey en texto plano.
2. En la base de datos no existe ningún registro de la clave en texto plano y solo figura su hash.
3. La clave queda asociada unívocamente al usuario autenticado.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con un JWT válido que no posee una ApiKey previa, **When** solicita la emisión de una ApiKey mediante POST, **Then** el sistema responde con éxito devolviendo la ApiKey en texto plano por única vez junto con su fecha de emisión.
2. **Given** una ApiKey recién generada, **When** se inspecciona la base de datos o almacenamiento persistente, **Then** solo se encuentra una versión hasheada criptográficamente de la clave y nunca su valor original en texto plano.
3. **Given** una emisión exitosa, **When** se analizan los logs estructurados y de auditoría del sistema, **Then** la ApiKey en texto plano no aparece en ningún registro ni traza.

---

### User Story 2 - Rotación y reemplazo de ApiKey existente (Priority: P1)

Un usuario que ya posee una ApiKey activa solicita la generación de una nueva (por ejemplo, por rotación periódica o porque extravió el valor original). El sistema genera la nueva ApiKey, la almacena hasheada y revoca/invalida de inmediato la ApiKey anterior, garantizando que el usuario continúe teniendo una sola ApiKey activa a la vez.

**Why this priority**: Garantiza la regla de negocio de que cada usuario tiene a lo sumo una única ApiKey activa simultáneamente y provee el único mecanismo disponible ante extravío de credenciales.

**Independent Test**: Se puede probar de forma aislada emitiendo una primera ApiKey para un usuario, solicitando inmediatamente una segunda ApiKey, y verificando que la segunda es emitida exitosamente mientras que el hash o identificador de la primera queda invalidado o sustituido.

**Acceptance Scenarios**:

1. **Given** un usuario que ya cuenta con una ApiKey activa, **When** solicita la emisión de una nueva ApiKey con un JWT válido, **Then** el sistema invalida inmediatamente la ApiKey previa y entrega la nueva ApiKey en texto plano en la respuesta.
2. **Given** la invalidación de la ApiKey anterior tras una re-emisión, **When** se evalúa el estado de credenciales del usuario, **Then** la clave anterior deja de ser utilizable para autenticarse y solo la nueva queda registrada como activa.
3. **Given** un usuario que extravió su ApiKey, **When** solicita una nueva emisión, **Then** obtiene una clave de reemplazo válida sin necesidad de conocer ni presentar el valor de la clave perdida.

---

### User Story 3 - Protección del endpoint ante accesos no autenticados (Priority: P2)

Cualquier solicitud de emisión de ApiKey que se reciba sin credenciales JWT, con un token malformado o con un token expirado es rechazada de inmediato sin alterar el estado de las claves del usuario.

**Why this priority**: Esencial para la seguridad del sistema, impidiendo que clientes anónimos o no autorizados generen credenciales en nombre de usuarios del sistema.

**Independent Test**: Se puede probar de forma aislada enviando peticiones POST al endpoint de emisión: (a) sin header de autorización, (b) con un token inválido/adulterado, y (c) con un token expirado, verificando que todas retornan código 401 Unauthorized y no se crea ninguna ApiKey.

**Acceptance Scenarios**:

1. **Given** una petición al endpoint de emisión sin ningún encabezado de autorización, **When** es procesada, **Then** el sistema responde con 401 Unauthorized y no se genera ninguna ApiKey.
2. **Given** una petición con un token JWT malformado o con firma digital inválida, **When** es procesada, **Then** el sistema responde con 401 Unauthorized.
3. **Given** una petición con un token JWT cuyo tiempo de vida expiró, **When** es procesada, **Then** el sistema responde con 401 Unauthorized.
4. **Given** un usuario que ya tenía una ApiKey activa y cuyo intento de re-emisión falla por autenticación inválida, **When** se inspecciona su estado, **Then** su ApiKey previa permanece intacta y activa.

---

### Edge Cases

- **Peticiones de emisión concurrentes para el mismo usuario**: Si llegan dos peticiones de emisión simultáneas con el mismo JWT de usuario, el sistema debe procesarlas de manera atómica transaccionalmente, garantizando que el estado final resulte en exactamente una única ApiKey activa (la de la última transacción confirmada), sin duplicaciones ni estados inconsistentes.
- **Pérdida u olvido de la ApiKey por parte del usuario**: No existe ningún mecanismo ni endpoint para consultar, descifrar o reenviar la ApiKey emitida. El usuario debe generar una nueva, lo que forzosamente invalidará la anterior.
- **Cuerpo (body) de la solicitud POST**: La emisión de ApiKey no requiere parámetros en el payload; si el cliente envía campos adicionales o un cuerpo vacío, el sistema procesa la emisión normalmente o descarta/sanitiza el payload de acuerdo a las reglas globales de DTO sin fallar innecesariamente.
- **Usuario inexistente o dado de baja con JWT vigente**: Si un JWT técnicamente válido corresponde a un identificador de usuario que ya no existe o fue desactivado, la solicitud de emisión se rechaza con 401 Unauthorized.
- **Fallas durante el almacenamiento**: Si ocurre un error al persistir el nuevo hash de la ApiKey, la transacción se aborta por completo: ni la clave previa se invalida ni se expone la nueva clave al usuario.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer una operación de emisión de ApiKey accesible únicamente mediante el método HTTP POST en un endpoint dedicado.
- **FR-002**: La operación de emisión de ApiKey MUST exigir un JWT válido correspondiente a un usuario autenticado en la plataforma.
- **FR-003**: Si la petición no incluye un JWT, o si el token es inválido, malformado o ha expirado, el sistema MUST rechazar la solicitud con error de no autenticado (HTTP 401) sin generar ni modificar ninguna ApiKey.
- **FR-004**: Al invocar la emisión con un JWT válido, el sistema MUST generar una ApiKey con entropía criptográficamente segura (cadena pseudoaleatoria impredecible y no reproducible).
- **FR-005**: El sistema MUST almacenar únicamente una representación hasheada de la ApiKey y MUST NOT persistir la clave en texto plano en la base de datos bajo ninguna circunstancia.
- **FR-006**: La operación de emisión MUST retornar la ApiKey generada en texto plano en el cuerpo de la respuesta HTTP por única vez en el momento de su emisión.
- **FR-007**: El sistema MUST garantizar que cada usuario tenga como máximo una única ApiKey activa a la vez en cualquier momento del tiempo.
- **FR-008**: Si el usuario ya poseía una ApiKey activa al momento de solicitar una nueva, el sistema MUST invalidar la clave anterior de forma inmediata, dejándola inhabilitada de forma irreversible para autenticar operaciones futuras.
- **FR-009**: El sistema MUST NOT proveer ningún endpoint ni mecanismo para listar, consultar o recuperar el valor en texto plano de una ApiKey ya emitida.
- **FR-010**: El sistema MUST NOT registrar el valor de la ApiKey en texto plano en logs de consola, archivos de log estructurado, mensajes de error ni trazas de auditoría en ninguna de sus capas.
- **FR-011**: La operación de reemplazo de la ApiKey MUST ser atómica: la invalidación de la clave existente, el almacenamiento del nuevo hash y la preparación de la respuesta deben confirmarse conjuntamente en una única transacción o abortarse en su totalidad ante cualquier fallo.

### Key Entities *(include if feature involves data)*

- **Usuario (User)**: Entidad que representa la cuenta del usuario en el sistema. Es el propietario exclusivo de la ApiKey.
- **ApiKey**: Representa la credencial técnica de acceso asociada al usuario. Atributos conceptuales principales:
  - **Identificador de usuario**: Referencia inequívoca al usuario dueño de la credencial.
  - **Hash de la clave**: Valor resultante de aplicar una función de hashing criptográfica sobre la ApiKey generada, utilizado para futuras verificaciones.
  - **Fecha de emisión (createdAt)**: Marca de tiempo en la que se generó la credencial.
  - **Estado / Validez**: Indicador de si la clave se encuentra activa o invalidada/reemplazada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario autenticado puede generar una nueva ApiKey en una única llamada al endpoint con un tiempo de respuesta menor a 1 segundo en condiciones normales.
- **SC-002**: El 100% de los intentos de solicitud de ApiKey sin un JWT válido, con token malformado o vencido son rechazados de forma inmediata con código 401.
- **SC-003**: En el 100% de los casos de re-emisión de una ApiKey para un mismo usuario, la clave previa queda invalidada y resulta imposible de utilizar para cualquier autenticación posterior.
- **SC-004**: Exactamente 0 ocurrencias de ApiKeys en texto plano almacenadas en la base de datos o expuestas en logs del sistema.
- **SC-005**: La ApiKey generada en texto plano solo se transmite en la respuesta de la petición POST de emisión y nunca vuelve a ser expuesta por ninguna otra vía.

## Assumptions

- La funcionalidad de autenticación base de usuarios, registro y emisión de JWTs está operativa según lo definido en la feature `001-user-auth`.
- El consumo y validación de la ApiKey en otros endpoints de negocio (guardias/estrategias de autenticación mediante cabeceras `x-api-key` o similar) será abordado por features o contratos específicos que la utilicen; esta spec delimita estrictamente la emisión, almacenamiento seguro e invalidación por reemplazo.
- La ApiKey activa no cuenta con una fecha de expiración automática por tiempo; permanece válida indefinidamente hasta que el usuario emita una nueva clave que la invalide.
- No se requiere un endpoint dedicado para listar ApiKeys ni para revocar la ApiKey sin emitir una nueva (ambas capacidades quedan explícitamente fuera del alcance de esta versión).
- El algoritmo de hashing aplicado sobre la ApiKey cumple con los estándares criptográficos robustos establecidos en la constitución del proyecto (al menos al mismo nivel de seguridad que el hashing de contraseñas de usuario).

