# Fixtures de WhoScored (006-whoscored-catalog-sync)

HTML real, capturado con `curl` (User-Agent de navegador) el 2026-09-22, sin
modificar. Se usan para testear el parseo de `HttpWhoScoredAdapter` sin pegarle
a la red en cada corrida de tests (research.md §8, contracts/whoscored-adapter.md).

- **`player-matchstatistics.html`** — `https://www.whoscored.com/players/123761/matchstatistics/bruno-fernandes`.
  Contiene, embebido en un `<script>` (`require.config.params['args']`), el
  array `tournaments` con las estadísticas de temporada por competencia
  (`TotalPasses`, `AccuratePasses`, `TotalShots`, `Interceptions`, `Rating`,
  `GameStarted`, `SubOn`) — la fuente real de las 4 métricas de rendimiento
  (FR-003, FR-007). La misma página trae, en el `<select>` de navegación del
  encabezado, el plantel completo del equipo actual del jugador con su código
  de posición corto (p. ej. `D(CL)`, `DMC`, `M(CLR)`, `AM(C)`, `FW`) — la
  fuente real del plantel + posición cruda que `mapWhoScoredPosition` traduce.
- **`league-teams.html`** — `https://www.whoscored.com/regions/252/tournaments/2/england-premier-league`.
  Lista, como enlaces `<a href="/teams/{id}/show/{slug}">`, los 20 equipos
  vigentes de la Premier League 2026-2027 — la fuente real de
  `fetchLeagueTeams`.

## Limitación conocida: descubrimiento del "jugador semilla" por equipo

`fetchTeamRoster` necesita al menos un id de jugador conocido de un equipo
para llegar a su página de `matchstatistics` y de ahí extraer el plantel
completo (arriba). Ni la página del equipo (`/teams/:id/show/:slug`) ni la de
sus fixtures exponen estáticamente ningún id de jugador (verificado
empíricamente contra el sitio real): esos listados se completan por
JavaScript/AJAX del lado del cliente, algo que este Adapter —a propósito, ver
research.md §4— no ejecuta.

`HttpWhoScoredAdapter` resuelve esto con un mapa `teamId → jugador semilla`
que arma una vez por liga y por corrida, leyendo el array `playerAssistData`
embebido en la página de estadísticas de jugadores de la liga
(`.../playerstatistics/...`). Es **cobertura best-effort**: sólo cubre los
equipos que tengan al menos una asistencia registrada en la temporada. Un
equipo sin ninguna semilla disponible ese día simplemente no tiene forma de
resolverse esa corrida — se trata igual que cualquier otra falla a nivel de
equipo (FR-014/015): ese equipo se saltea, conserva su última sincronización
exitosa, y el resto de la liga sigue. No es una violación del contrato de la
spec (FR-005 exige plantel completo *cuando la sincronización de ese equipo es
exitosa*, no que todo equipo se sincronice siempre).

Mejorar la cobertura de semillas (combinar más de una fuente embebida, o
recordar el último jugador activo conocido de cada equipo entre corridas para
auto-sanarse con el tiempo) es trabajo de mantenimiento futuro, no bloqueante
para esta feature.
