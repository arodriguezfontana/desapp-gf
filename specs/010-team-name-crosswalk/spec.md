# Feature Specification: Team Name Crosswalk (WhoScored ↔ Football-Data)

**Feature Branch**: `010-team-name-crosswalk`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Feature: cruce de equipos WhoScored ↔ Football-Data. Se establece la infraestructura de mapeo que permite, dado un nombre de equipo proveniente de WhoScored, encontrar el equipo correspondiente en Football-Data.org. Es prerequisito técnico para la feature de cotización: sin este cruce no hay forma de asociar un jugador con las standings de su liga. La solución tiene tres piezas: una función de normalización de texto, una tabla de excepciones manuales para los casos que la normalización no puede resolver, y un servicio de sincronización semanal que puebla la tabla de equipos resueltos..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nombre de equipo WhoScored resuelve al equipo Football-Data correspondiente (Priority: P1)

Como sistema de cotización, necesito poder asociar un jugador (cuyo equipo viene de WhoScored) con la tabla de posiciones de su liga (que viene de Football-Data), para poder calcular la valuación del jugador con contexto de standing.

**Why this priority**: Sin este cruce no existe ninguna forma de relacionar un jugador con su posición en la liga. Es el prerequisito técnico de toda la feature de cotización.

**Independent Test**: Se puede probar en aislamiento total con una función pura: dado un nombre de equipo de WhoScored y una lista de standings (instancias de la entidad `Standing` ya existente), verificar que devuelve el standing correcto o `null`. No requiere base de datos ni red.

**Acceptance Scenarios**:

1. **Given** un nombre de equipo de WhoScored cuya diferencia con el nombre en Football-Data es solo un prefijo/sufijo estándar ("FC", "AFC") o un acento/diéresis, **When** se ejecuta la resolución, **Then** el equipo de Football-Data correspondiente es devuelto correctamente.
2. **Given** un nombre de equipo de WhoScored que diverge semánticamente del nombre en Football-Data (ej. "Lyon" vs "Olympique Lyonnais"), y existe una excepción manual registrada para ese nombre, **When** se ejecuta la resolución, **Then** el equipo de Football-Data correspondiente indicado en la excepción es devuelto.
3. **Given** un nombre de equipo de WhoScored que no normaliza al mismo resultado que ningún equipo de Football-Data y no tiene excepción manual registrada, **When** se ejecuta la resolución, **Then** se devuelve `null`.
4. **Given** una lista de equipos de Football-Data vacía, **When** se ejecuta la resolución con cualquier nombre de WhoScored, **Then** se devuelve `null` sin error.

---

### User Story 2 - Sincronización semanal del crosswalk con visibilidad de cobertura (Priority: P2)

Como equipo de desarrollo, quiero que el cruce de equipos se ejecute automáticamente cada semana, después de las sincronizaciones de WhoScored y de Football-Data, y que deje registrado qué equipos quedaron sin resolver, para detectar divergencias y decidir si agregar excepciones manuales sin tener que ejecutar nada a mano.

**Why this priority**: Sin esta corrida periódica, los equipos nuevos no tienen escudo hasta que alguien se acuerde de ejecutar el cruce. Sin el registro de no resueltos, el equipo no tiene visibilidad sobre qué equipos necesitan una excepción manual antes de que el sistema de cotización los silencie con `null`.

**Independent Test**: Invocar `TeamCrosswalkSyncService.sync()` con repositorios simulados: devuelve la cantidad de equipos resueltos y la lista de no resueltos, y hace upsert en `teams` solo de los resueltos. No requiere red ni NestJS.

**Acceptance Scenarios**:

1. **Given** jugadores persistidos con distintos valores de `team` (de WhoScored) y las standings de Football-Data ya persistidas por la feature 007, **When** corre el cron semanal del crosswalk (domingos a las 06:00), **Then** se hace upsert en `teams` de todos los equipos que resuelven (por normalización o por excepción) y se registra en el log cuántos resolvieron y cuántos no.
2. **Given** al menos un equipo de WhoScored que no resuelve ni por normalización ni por excepción, **When** corre el servicio, **Then** su nombre se registra en un `warn` del log para revisión manual y no se inserta en `teams`.
3. **Given** que todos los equipos resuelven, **When** corre el servicio, **Then** no se emite ningún `warn` de equipos sin resolver.
4. **Given** un error inesperado durante la corrida, **When** el cron la ejecuta, **Then** el error se registra y no se propaga al scheduler; y si la corrida anterior sigue en curso, la nueva se salta.

---

### User Story 3 - Tabla persistente de equipos resueltos con escudo garantizado (Priority: P1)

Como sistema de cotización y como catálogo de jugadores, necesito poder obtener el escudo de un equipo dado su nombre de WhoScored con una única consulta a la base de datos, sin recalcular `resolveTeam` en cada request, y con la garantía de que todos los equipos que alguna vez se sincronizaron tienen su escudo persistido.

**Why this priority**: La resolución en memoria de `resolveTeam` por cada request (con carga de standings y excepciones completas) no escala y no garantiza que todos los equipos tengan escudo. Una tabla `teams` convierte el resultado del crosswalk en un dato de primera clase, consultable directamente por `Player.team`.

**Independent Test**: Dado una tabla `teams` con filas cargadas, una consulta por `whoScoredName` devuelve el `Team` correspondiente con su `crestUrl`. Si el nombre no existe en la tabla, devuelve `null`. No requiere lógica de normalización ni carga de standings.

**Acceptance Scenarios**:

1. **Given** que el servicio de crosswalk corrió exitosamente para un equipo cuyo nombre WhoScored resuelve por normalización o excepción, **When** se consulta la tabla `teams` por ese nombre, **Then** devuelve el equipo con `footballDataTeamId`, `footballDataTeamName`, `leagueCode` y `crestUrl` correctos.
2. **Given** un `Player` con `team = "Lyon"` y una excepción manual que lo mapea a "Olympique Lyonnais", y el servicio corrió, **When** el catálogo consulta el escudo del jugador, **Then** devuelve el escudo del Olympique Lyonnais sin recalcular nada en memoria.
3. **Given** un nombre de equipo WhoScored que no tiene match (ni por normalización ni por excepción), **When** se consulta la tabla `teams` por ese nombre, **Then** devuelve `null` — la tabla no tiene entradas especulativas.
4. **Given** que se agrega una excepción manual y el servicio corre nuevamente, **When** se consulta la tabla `teams`, **Then** el equipo antes sin resolver ahora tiene su fila con escudo.

---

### Edge Cases

- **Nombre de equipo vacío o nulo desde WhoScored**: la función de resolución devuelve `null` sin lanzar excepción.
- **Tabla de excepciones vacía**: el sistema opera normalmente con sólo la normalización; ningún paso falla por ausencia de excepciones registradas.
- **Nombre de equipo WhoScored que coincide con más de un equipo Football-Data tras normalizar**: situación imposible en la práctica dado el universo acotado (~98 equipos únicos en 5 ligas), pero si ocurriera la función devuelve el primero en orden y lo registra en el log de cobertura.
- **Football-Data devuelve un nombre de equipo distinto al de la temporada anterior (cambio de nombre del club)**: la excepción manual correspondiente debe actualizarse; el sistema devuelve `null` hasta que se actualice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST proveer una función pura `normalizeTeamName(name: string): string` que convierte el nombre a minúsculas, elimina acentos y diéresis, y descarta los prefijos y sufijos comunes: `FC`, `AFC`, `CF`, `SC`, `SL`, `AS`, `SS`, `FK`. Esta función MUST vivir en el dominio y MUST NOT tener dependencias de NestJS, TypeORM ni ninguna librería de infraestructura.
- **FR-002**: El sistema MUST proveer una función pura de dominio `resolveTeam(whoScoredTeamName: string, standings: Standing[], exceptions: TeamNameException[]): Standing | null` que recibe standings del repositorio existente (feature 007) — no se crea ninguna entidad nueva para este fin. Intenta resolver el equipo en dos pasos: primero compara `normalizeTeamName(whoScoredTeamName)` contra `normalizeTeamName(standing.teamName)` para cada elemento de `standings`; si no hay coincidencia, busca en `exceptions` por `whoScoredRawName` exacto (case-sensitive, exactamente como WhoScored lo devuelve). Devuelve `null` si ningún paso resuelve. Los campos del standing resultante relevantes para el consumidor son `externalTeamId: number` y `teamName: string`.
- **FR-003**: El sistema MUST proveer una tabla persistente `team_name_exception` con los campos `whoScoredRawName` (clave, string exacto de WhoScored), `footballDataTeamId` (número), `footballDataTeamName` (string) y `league` (una de las 5 ligas soportadas). La tabla MUST comenzar vacía; las entradas se agregan solo cuando se detecta un mismatch real, nunca preventivamente.
- **FR-004**: El sistema MUST proveer un servicio `TeamCrosswalkSyncService` con un `@Cron` semanal (domingos a las 06:00, `0 6 * * 0`), posterior a los crons de WhoScored y de Football-Data (domingos a las 00:00), que: (a) lee las standings ya persistidas por la feature 007, sin llamar a la API de Football-Data, (b) obtiene los valores distintos de `Player.team` de los jugadores activos, (c) carga las excepciones de `team_name_exception`, (d) ejecuta `resolveTeam` para cada equipo, (e) hace upsert de los resueltos en `teams` (ver FR-008) y (f) registra en el log un resumen con la cantidad de resueltos y sin resolver, y un `warn` con los nombres sin resolver. Un error inesperado MUST registrarse sin propagarse al scheduler, y si hay una corrida en curso la nueva MUST saltearse.
- **FR-005**: La función `resolveTeam` MUST NOT exponer ningún endpoint HTTP ni ser invocable desde fuera del sistema. Es exclusivamente de uso interno, usada por `TeamCrosswalkSyncService` para poblar la tabla `teams`.
- **FR-006**: El sistema MUST documentar como decisión de diseño explícita la elección de normalización + excepciones manuales por sobre fuzzy matching, incluyendo la justificación: en un universo acotado de ~98 equipos, el fuzzy matching introduce falsos positivos inevitables (ej. "Atletico Madrid" matcheando "Atletico Bilbao"), mientras que la normalización cubre el 90% de casos sin ambigüedad y las excepciones manuales resuelven los restantes de forma explícita y auditable.
- **FR-007**: El sistema MUST proveer una tabla persistente `teams` con los campos: `id` (uuid, PK), `whoscored_name` (varchar, unique — exactamente como WhoScored lo devuelve), `football_data_team_id` (integer), `football_data_team_name` (varchar), `league_code` (varchar), `crest_url` (varchar, nullable). Esta tabla es el resultado materializado del crosswalk: almacena el mapping WhoScored → Football-Data junto con el escudo, de modo que las consultas por `whoscored_name` sean O(1) sin recalcular `resolveTeam` en cada request.
- **FR-008**: `TeamCrosswalkSyncService` MUST hacer upsert en la tabla `teams` de todos los equipos que resuelven (por normalización o excepción), utilizando `whoscored_name` como clave de upsert. Los equipos que no resuelven NO se insertan — su ausencia en la tabla indica que requieren intervención manual. El servicio MUST NOT eliminar filas existentes que ya no aparezcan en el resultado (las excepciones recién agregadas se acumulan en corridas sucesivas).
- **FR-009**: El servicio que enriquece al jugador con su escudo (`PlayerEnrichmentService`) MUST consultar la tabla `teams` por `whoscored_name = player.team` para obtener el `crestUrl`, en lugar de ejecutar `resolveTeam` en memoria con carga completa de standings y excepciones. Si el nombre no existe en `teams`, devuelve `crestUrl = null`.

### Key Entities

- **TeamNameException**: excepción manual que mapea un nombre de equipo exacto de WhoScored (`whoScoredRawName`) al equipo correspondiente en Football-Data (`footballDataTeamId`, `footballDataTeamName`, `league`). Persiste en base de datos. Tabla: `team_name_exception`.
- **Standing**: entidad existente (feature 007). Es la que `resolveTeam` recibe como input para resolver el mapping. Los campos que usa el crosswalk son `externalTeamId: number`, `teamName: string` y `crestUrl: string | null`.
- **Team** *(nuevo)*: resultado materializado del crosswalk. Almacena el mapping WhoScored → Football-Data con el escudo para consulta directa. Campos: `id`, `whoScoredName`, `footballDataTeamId`, `footballDataTeamName`, `leagueCode`, `crestUrl`. Tabla: `teams`. Clave de negocio: `whoScoredName` (único). Poblada por `TeamCrosswalkSyncService`, consumida por `PlayerEnrichmentService`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para las 5 ligas soportadas, al menos el 90% de los equipos distintos persistidos desde WhoScored resuelven a su equipo Football-Data correspondiente por normalización sola, sin requerir ninguna excepción manual. (Medible con el log de la primera corrida del crosswalk tras la primera sincronización real de datos.)
- **SC-002**: El 100% de los equipos que no resuelven quedan registrados en el log (nivel `warn`) en cada corrida del servicio, sin que el servicio omita ninguno ni falle en su ejecución.
- **SC-003**: La función `resolveTeam` es una función pura verificable en tests unitarios sin levantar NestJS ni conectarse a ninguna base de datos ni red.
- **SC-004**: Agregar una excepción manual a la tabla `team_name_exception` hace que, en la siguiente corrida del servicio, el equipo correspondiente aparezca en la tabla `teams` con su escudo, sin necesidad de modificar código ni redeployar.
- **SC-005**: Tras una corrida del servicio con 0 equipos sin resolver, todos los jugadores cuyo `Player.team` tiene entrada en la tabla `teams` muestran el escudo de su equipo en el catálogo y en el detalle, sin ninguna llamada adicional a standings ni a `resolveTeam` en runtime.

## Assumptions

- **Universo acotado y estable**: las 5 ligas cubren aproximadamente 98 equipos en total. Los nombres de los equipos en Football-Data no cambian durante la temporada (salvo excepciones rarísimas de cambio de nombre de club), por lo que la tabla de excepciones es de mantenimiento muy bajo.
- **WhoScored como fuente de `Player.team`**: el valor de `Player.team` en la base de datos es exactamente el string que WhoScored devuelve en `WhoScoredTeamRef.team`, sin transformaciones previas.
- **Standings de Football-Data ya sincronizados**: el servicio de crosswalk asume que la sincronización de Football-Data (feature 007) ya corrió al menos una vez y existen registros de standings con `teamId` y `teamName` en la base de datos. Si la tabla de standings está vacía, ningún equipo resuelve y todos se informan como sin resolver; la siguiente corrida semanal los resuelve.
- **Sin UI**: esta feature es exclusivamente de infraestructura interna. No agrega ni modifica ninguna vista de frontend.
- **La resolución de `null` es un estado válido y gestionado por el consumidor**: `resolveTeam` devuelve `null` cuando no puede resolver. La feature de cotización (consumidor) es responsable de decidir qué hacer en ese caso; esta spec no define ese comportamiento.

## Design Decisions

### Normalización + excepciones manuales vs. fuzzy matching

Se descarta fuzzy matching (Levenshtein, Jaro-Winkler) por dos razones:

1. **Falsos positivos inevitables**: cualquier umbral de similitud que acepte "Manchester City FC" ↔ "Manchester City" también acepta "Atletico Madrid" ↔ "Atletico Bilbao". En un universo donde coexisten equipos con nombres similares, el umbral correcto no existe.
2. **Opacidad**: un match fuzzy es difícil de auditar y de explicar cuando falla. Una tabla de excepciones es explícita, versionable y revisable en un PR.

La normalización cubre el ~90% de diferencias reales (prefijos `FC`/`AFC`, acentos, diéresis). El 10% restante se resuelve con entradas manuales que se agregan solo cuando se detecta un mismatch concreto, no preventivamente.
