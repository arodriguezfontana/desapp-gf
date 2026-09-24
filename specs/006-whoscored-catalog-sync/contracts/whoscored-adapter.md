# Contrato interno — `WhoScoredAdapter`

No es un contrato REST expuesto por el sistema: es el contrato entre
`PlayerSyncService` y el sistema externo (WhoScored) del que depende, aislado
detrás de un puerto de dominio (constitución, Principio I). Se documenta acá
porque define un límite de sistema tan importante como un endpoint público —
mismo criterio que `player-api.md` documenta `ApiKeyGuard` aunque no sea "la"
API pedida por el usuario final.

## Puerto (`adapters/whoscored-adapter.ts`)

Ver data-model.md § "Puerto: WhoScoredAdapter" y research.md §3 para la
interfaz completa. Resumen de contrato de comportamiento (firmas as-built —
ver "Sin estado compartido entre llamadas" abajo para el porqué de los
parámetros extra):

| Método | Éxito | Falla |
|--------|-------|-------|
| `fetchLeagueTeams(league)` | `WhoScoredLeagueTeams` — `{ tournamentId, teams, seedPlayerByTeam }`. `teams` son todos los equipos vigentes de esa liga en la temporada en curso (puede ser `[]` si WhoScored no lista ninguno; no debería ocurrir para las 5 ligas soportadas, pero no es un error del Adapter). `tournamentId` es el id de WhoScored de esa liga/temporada. `seedPlayerByTeam` es `externalTeamId → externalId de un jugador conocido de ese equipo`, best-effort (ver "Jugador semilla" abajo) — puede no tener entrada para todos los equipos devueltos en `teams`. | Lanza (red, timeout de 15000ms, o estructura de página inesperada). `PlayerSyncService` lo trata como fallo de esa liga en esa corrida (spec FR-014/015 nivel liga): la liga entera se saltea, las demás siguen. |
| `fetchTeamRoster(team, tournamentId, seedPlayerId)` | `WhoScoredRawPlayer[]` — el plantel completo del equipo, sin tope de cantidad (FR-005). `tournamentId` y `seedPlayerId` los recibe explícitos de quien orquesta (nunca los resuelve ni los recuerda el Adapter — ver abajo). Cada jugador trae su código de posición **sin mapear** y, si se pudo obtener, sus 4 métricas (`metrics`), o `metrics: null` + `metricsFetchFailed` distinguiendo "sin partidos" de "falla técnica" (ver abajo). | Lanza si no se pudo obtener el plantel del equipo en sí (incluido si vino vacío — 0 jugadores es indistinguible de "el selector no matcheó nada porque WhoScored cambió la estructura de la página", nunca un roster real de un club profesional). `PlayerSyncService` lo trata como fallo de ese equipo en esa corrida (FR-014/015 nivel equipo): el equipo entero mantiene su última sincronización exitosa, los demás equipos siguen. Un fallo puntual de la página de stats de UN jugador **no** debe propagarse como excepción acá — ver siguiente fila. |

### Jugador semilla: responsabilidad de quien orquesta, no del Adapter

El Adapter **no** valida que exista un jugador semilla para un equipo antes
de llamar a `fetchTeamRoster`: quien orquesta (`PlayerSyncService`) MUST
resolver `seedPlayerByTeam.get(team.externalTeamId)` él mismo y, si no hay
entrada, tratarlo directamente como una falla de ese equipo (mismo log y
mismo `return` sin persistir que usa para un `fetchTeamRoster` que lanza) —
**sin llegar a invocar** `fetchTeamRoster` en absoluto. Antes esto lo
resolvía el propio Adapter (lookup interno + `throw`); se movió al
orquestador como parte de sacar todo el estado compartido del Adapter (ver
abajo). El efecto observable para el equipo no cambia: se saltea, conserva su
última sincronización exitosa, no afecta a los demás equipos ni a la liga.

### Sin estado compartido entre llamadas (`HttpWhoScoredAdapter`)

El Adapter es un singleton de Nest. En una versión anterior guardaba
`tournamentId` y `seedPlayerByTeam` como campos de instancia, escritos por
`fetchLeagueTeams` y leídos después por `fetchTeamRoster`/
`fetchPlayerMetrics` — eso asumía implícitamente que nunca habría dos
corridas de `sync()` en vuelo al mismo tiempo sobre la misma instancia, algo
que el código no garantizaba (el `@Cron` no tenía `waitForCompletion`, así
que dos corridas solapadas eran posibles y se hubiesen pisado ese estado
entre sí). Se corrigió sacando ambos campos: `fetchLeagueTeams` devuelve
`tournamentId` y `seedPlayerByTeam` como parte de su valor de retorno,
`fetchTeamRoster` los recibe como parámetros explícitos. El Adapter no tiene
ningún campo mutable entre llamadas (sólo el `logger`). Como defensa en
profundidad adicional, `PlayerSyncService.sync()` usa
`@Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })` para que el
scheduler tampoco dispare una corrida nueva mientras la anterior sigue
corriendo — pero la garantía de fondo es la ausencia de estado compartido,
no ese flag.

### Semántica de `metrics` / `metricsFetchFailed` por jugador

| `metrics` | `metricsFetchFailed` | Significa | Efecto en `PlayerSyncService` |
|-----------|----------------------|-----------|-------------------------------|
| objeto con las 4 métricas | `false` | Se obtuvo y parseó la página de `matchstatistics` con datos. | Se importa con esos valores. |
| `null` | `false` | La página se obtuvo y parseó bien, pero el jugador no registra partidos en la temporada en curso (legítimo, spec Assumptions). | Se importa con las 4 métricas en `null`. **No** genera entrada en el log de revisión manual. |
| `null` | `true` | No se pudo obtener o parsear la página de `matchstatistics` de ese jugador puntual (red, timeout, estructura inesperada). | Se importa igual (nombre/liga/equipo/posición si se conocen) con las 4 métricas en `null` (FR-018) **y** una entrada en el log de revisión manual (`reason: 'stats-fetch-failed'`). |

## Implementación concreta (`adapters/http-whoscored-adapter.ts`)

- HTTP: `got-scraping` (versión pinneada `3.2.15`, no `axios` — research.md
  §4: `axios` es bloqueado por el fingerprint TLS/HTTP2 de Cloudflare en el
  sitio real, `got-scraping` lo imita), timeout `WHOSCORED_REQUEST_TIMEOUT_MS`
  (15000ms) por request vía `{ timeout: { request: ... } }`. No se fuerza un
  `User-Agent` manual: `got-scraping` genera un set de headers consistente
  con el fingerprint TLS que negocia.
- Parseo: `cheerio` sobre el HTML de respuesta. WhoScored sirve el detalle de
  partido/estadística como HTML server-rendered con los datos incrustados
  (no requiere ejecutar JS de cliente) — de ahí que un fixture HTML estático
  alcance para testear el parseo end-to-end (ver "Contrato de test" abajo).
- Tabla liga → identificadores de WhoScored (región/torneo/temporada): config
  interna del Adapter, 5 entradas fijas, nunca expuesta fuera de
  `http-whoscored-adapter.ts` (el dominio no conoce ids de WhoScored).

## Contrato de test: fixture HTML capturado, nunca el sitio real

- `backend/test/fixtures/whoscored/` — al menos un HTML real de una página de
  `matchstatistics` capturado y versionado (research.md §8). Cubre el caso
  "métricas disponibles"; se recomienda un segundo fixture (o una variante
  recortada) para el caso "jugador sin partidos en la temporada" si la
  estructura de esa página difiere lo suficiente como para necesitar un
  parseo distinto.
- Los tests unitarios de `HttpWhoScoredAdapter` mockean `got-scraping`
  (`jest.mock('got-scraping', () => ({ gotScraping: { get: jest.fn() } }))`)
  para que `.get(...)` resuelva con el contenido de esos fixtures (como
  `{ body: html }`, no `{ data: html }` — forma de la respuesta de `got`); el
  parseo real (`cheerio`) se ejecuta sin red.
- Ningún test de este proyecto (unitario, integración ni e2e) hace una
  request real a `whoscored.com`. Determinístico y no depende de que
  WhoScored esté arriba ni de que no haya cambiado su estructura (pedido
  explícito del usuario).
- `PlayerSyncService` se testea con un `WhoScoredAdapter` fake (no HTTP, sin
  fixture) que devuelve datos ya "parseados" fijos — la responsabilidad de
  parsear HTML real queda acotada a los tests del Adapter (research.md §8).
