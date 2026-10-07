# Feature Specification: Team Name Crosswalk (WhoScored ↔ Football-Data)

**Feature Branch**: `010-team-name-crosswalk`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Feature: cruce de equipos WhoScored ↔ Football-Data. Se establece la infraestructura de mapeo que permite, dado un nombre de equipo proveniente de WhoScored, encontrar el equipo correspondiente en Football-Data.org. Es prerequisito técnico para la feature de cotización: sin este cruce no hay forma de asociar un jugador con las standings de su liga. La solución tiene tres piezas: una función de normalización de texto, una tabla de excepciones manuales para los casos que la normalización no puede resolver, y un script de población inicial..."

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

### User Story 2 - Verificación de cobertura inicial sobre datos reales (Priority: P2)

Como equipo de desarrollo, quiero poder ejecutar una verificación de cobertura que cruce los equipos actualmente persistidos (provenientes de WhoScored) contra los equipos que devuelve Football-Data, para identificar qué equipos quedan sin resolver y decidir si agregar excepciones manuales.

**Why this priority**: Sin esta verificación, el equipo no tiene visibilidad sobre cuántos equipos resuelven por normalización y cuáles necesitan una excepción manual. Es la única forma de detectar divergencias semánticas antes de que el sistema de cotización las silencia con `null`.

**Independent Test**: Se puede ejecutar el script de verificación de cobertura de forma independiente. La salida esperada es un resumen en consola (cuántos resuelven, cuántos no) y un archivo de texto con los nombres sin resolver. El script no modifica la base de datos.

**Acceptance Scenarios**:

1. **Given** jugadores persistidos en la base de datos con distintos valores de `team` (de WhoScored) y las standings vigentes de Football-Data para las 5 ligas, **When** se ejecuta el script de cobertura, **Then** el script imprime cuántos equipos distintos de WhoScored resuelven por normalización y cuántos no.
2. **Given** al menos un equipo de WhoScored que no resuelve por normalización, **When** se ejecuta el script de cobertura, **Then** ese nombre se escribe en `team_crosswalk_unresolved.txt` en la raíz del proyecto para revisión manual.
3. **Given** que todos los equipos resuelven por normalización, **When** se ejecuta el script de cobertura, **Then** el archivo `team_crosswalk_unresolved.txt` no se genera o queda vacío.

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
- **FR-004**: El sistema MUST proveer un script ejecutable con `npm run seed:crosswalk` que: (a) consulta el endpoint de standings de Football-Data para las 5 ligas, (b) obtiene los valores distintos de `Player.team` actualmente persistidos, (c) ejecuta `resolveTeam` para cada uno, (d) imprime en consola un resumen con el total de equipos evaluados, cuántos resuelven por normalización y cuántos no, y (e) escribe los nombres sin resolver en `team_crosswalk_unresolved.txt` en la raíz del proyecto. El script MUST NOT escribir en la base de datos.
- **FR-005**: La función `resolveTeam` MUST NOT exponer ningún endpoint HTTP ni ser invocable desde fuera del sistema. Es exclusivamente de uso interno, consumida por la feature de cotización.
- **FR-006**: El sistema MUST documentar como decisión de diseño explícita la elección de normalización + excepciones manuales por sobre fuzzy matching, incluyendo la justificación: en un universo acotado de ~98 equipos, el fuzzy matching introduce falsos positivos inevitables (ej. "Atletico Madrid" matcheando "Atletico Bilbao"), mientras que la normalización cubre el 90% de casos sin ambigüedad y las excepciones manuales resuelven los restantes de forma explícita y auditable.

### Key Entities

- **TeamNameException**: excepción manual que mapea un nombre de equipo exacto de WhoScored (`whoScoredRawName`) al equipo correspondiente en Football-Data (`footballDataTeamId`, `footballDataTeamName`, `league`). Persiste en base de datos. Tabla: `team_name_exception`.
- **Standing**: entidad existente (feature 007). Es la que `resolveTeam` recibe y devuelve — no se crea ninguna entidad nueva. Los campos que usa el crosswalk son `externalTeamId: number` y `teamName: string`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para las 5 ligas soportadas, al menos el 90% de los equipos distintos persistidos desde WhoScored resuelven a su equipo Football-Data correspondiente por normalización sola, sin requerir ninguna excepción manual. (Medible ejecutando `npm run seed:crosswalk` tras la primera sincronización real de datos.)
- **SC-002**: El 100% de los equipos que no resuelven por normalización quedan documentados en `team_crosswalk_unresolved.txt` tras ejecutar el script de cobertura, sin que el script omita ninguno ni falle en su ejecución.
- **SC-003**: La función `resolveTeam` es una función pura verificable en tests unitarios sin levantar NestJS ni conectarse a ninguna base de datos ni red.
- **SC-004**: Agregar una excepción manual a la tabla `team_name_exception` hace que el equipo correspondiente resuelva en la próxima ejecución de `resolveTeam`, sin necesidad de modificar código ni redeployar.

## Assumptions

- **Universo acotado y estable**: las 5 ligas cubren aproximadamente 98 equipos en total. Los nombres de los equipos en Football-Data no cambian durante la temporada (salvo excepciones rarísimas de cambio de nombre de club), por lo que la tabla de excepciones es de mantenimiento muy bajo.
- **WhoScored como fuente de `Player.team`**: el valor de `Player.team` en la base de datos es exactamente el string que WhoScored devuelve en `WhoScoredTeamRef.team`, sin transformaciones previas.
- **Standings de Football-Data ya sincronizados**: el script de cobertura asume que la sincronización de Football-Data (feature 007) ya corrió al menos una vez y existen registros de standings con `teamId` y `teamName` en la base de datos. Si no, el script llama directamente al endpoint de Football-Data (disponible en el plan free).
- **Sin UI**: esta feature es exclusivamente de infraestructura interna. No agrega ni modifica ninguna vista de frontend.
- **La resolución de `null` es un estado válido y gestionado por el consumidor**: `resolveTeam` devuelve `null` cuando no puede resolver. La feature de cotización (consumidor) es responsable de decidir qué hacer en ese caso; esta spec no define ese comportamiento.

## Design Decisions

### Normalización + excepciones manuales vs. fuzzy matching

Se descarta fuzzy matching (Levenshtein, Jaro-Winkler) por dos razones:

1. **Falsos positivos inevitables**: cualquier umbral de similitud que acepte "Manchester City FC" ↔ "Manchester City" también acepta "Atletico Madrid" ↔ "Atletico Bilbao". En un universo donde coexisten equipos con nombres similares, el umbral correcto no existe.
2. **Opacidad**: un match fuzzy es difícil de auditar y de explicar cuando falla. Una tabla de excepciones es explícita, versionable y revisable en un PR.

La normalización cubre el ~90% de diferencias reales (prefijos `FC`/`AFC`, acentos, diéresis). El 10% restante se resuelve con entradas manuales que se agregan solo cuando se detecta un mismatch concreto, no preventivamente.
