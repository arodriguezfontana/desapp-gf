# Phase 0 — Research: Catálogo de Jugadores con Datos Reales (WhoScored)

## §0. Correcciones a las precondiciones del pedido

El pedido de este plan afirma tres precondiciones que, al revisar el repo
(`feat/whoscored`, con `004-player-catalog` y `005-frontend-player-catalog` ya
mergeadas), **no son ciertas todavía**:

1. **`@nestjs/schedule` "instalado"**: no está en `backend/package.json`
   (`dependencies` sólo tiene `@nestjs/{common,config,core,jwt,platform-express,
   swagger,typeorm}`, `bcrypt`, `class-transformer`, `class-validator`, `pg`,
   `reflect-metadata`, `rxjs`, `typeorm`). Esta feature lo agrega.
2. **"Fixture HTML de WhoScored capturado y versionado"**: no existe ningún
   archivo relacionado con WhoScored en el repo todavía (`git grep -i whoscored`
   sólo matchea el nombre de la rama). Capturar y versionar ese fixture es parte
   del alcance de esta feature (tasks de implementación), no una precondición ya
   cumplida.
3. El resto de las precondiciones sí se verificaron: `Player` (TypeORM) y
   `GET /players`/`GET /players/:id` (filtro liga/equipo/posición + paginación)
   ya existen y funcionan (`backend/src/domain/player/`, `repositories/`,
   `services/player.service.ts`, `controllers/player.controller.ts`), protegidos
   por `ApiKeyGuard` (no JWT). Docker + `docker-compose.yml` de Postgres ya
   existen. Ninguno de estos archivos se modifica en su contrato externo.

Esto no cambia el alcance pedido, sólo ubica correctamente qué es "ya existe" vs
"lo agrega esta feature" (mismo criterio que `004-player-catalog/plan.md` aplicó
con `ApiKeyGuard`).

## §1. Reconciliación: "todo-o-nada" del pedido vs. la granularidad ya fijada en la spec

El pedido describe la sincronización como "todo-o-nada: si el scraping falla ...
`PlayerSyncService` no persiste nada de esa corrida". La spec (`006`, ya cerrada
con el usuario en dos rondas de corrección explícita) exige lo contrario a nivel
global: **tres niveles independientes** de éxito/fracaso —liga, equipo,
jugador— ninguno debe arrastrar a los demás (FR-014 a FR-016, FR-018). Adoptar
"todo-o-nada" a nivel de las 5 ligas completas violaría esos FR directamente.

**Decisión**: "todo-o-nada" se adopta, pero acotado a la unidad que la spec ya
define como atómica: **por equipo** (y, para el descubrimiento de qué equipos
existen, por liga). Cada corrida de sincronización de un equipo puntual persiste
todo o nada de *ese equipo* en una única transacción de base de datos
(`PlayerRepository.applyTeamRosterSync`, ver data-model.md); un fallo en un
equipo o liga no aborta ni ensucia el resto de la corrida global. Esto es
consistente con el pedido (nunca se persiste una mezcla a mitad de camino
*dentro de la unidad que falló*) y con la spec (el fallo no se propaga).

**Alternativa rechazada**: una transacción única para las 5 ligas. Descartada
por violar FR-014/FR-015 explícitamente y porque, con potencialmente miles de
páginas a scrapear por corrida (§6), descartar todo el trabajo ya exitoso de 4
ligas por la falla de la quinta es exactamente el comportamiento que la spec ya
rechazó como Design Decision.

## §2. Reconciliación: "upsert, no reemplazo total, para no perder cotizaciones" vs. FR-016 (baja = 404)

El pedido pide upsert por id externo de WhoScored "así un jugador que sale del
plantel no pierde las cotizaciones ya asociadas a él". La spec (FR-016) exige
que un jugador que sale del plantel **deje de estar disponible en el catálogo**
(`GET /players/:id` → 404 a partir de ese momento). A primera vista tensionan,
pero resuelven en capas distintas: FR-016 es un contrato de **API** (qué ve un
cliente de `GET /players`); "no perder las cotizaciones" es una preocupación de
**integridad referencial a nivel de base de datos** (que una fila que otra
tabla referencia por FK no desaparezca).

**Decisión**: baja lógica (`soft delete`), no física. `PlayerEntity` agrega
`removedAt: Date | null` —mismo patrón ya usado por `ApiKeyEntity.revokedAt`
(`domain/api-key/api-key.ts`, `TypeOrmApiKeyRepository` con `IsNull()`)—. La
sincronización de un equipo:
- Hace upsert por `externalId` (WhoScored) de los jugadores que sí están en el
  plantel scrapeado (`removedAt = NULL`).
- Marca `removedAt = now()` en los jugadores que antes estaban activos para ese
  equipo y ya no aparecen en el plantel scrapeado.

`PlayerRepository.findPage`/`findById` (lectura, usados por `PlayerService`)
agregan `WHERE removed_at IS NULL`: un jugador dado de baja deja de listarse y
su detalle responde 404 (FR-016 se cumple al pie de la letra desde la API),
pero la fila y su `id` interno siguen existiendo físicamente en `players`, así
que cualquier FK futura (Sistema de cotización) hacia ese `id` no se rompe. Si
el jugador vuelve a aparecer en un plantel en una corrida posterior, el mismo
upsert por `externalId` reactiva la fila (`removedAt = NULL`) en vez de crear
un duplicado.

**Alternativa rechazada**: DELETE físico. Rompería cualquier FK futura desde
cotizaciones (justo lo que el pedido quiere evitar) sin aportar nada que el
soft delete no dé ya desde la API.

## §3. Adapter: forma del puerto y separación de responsabilidades

Sigue el patrón ya establecido por `PasswordHasher`/`TokenIssuer`/`TokenHasher`
(interfaz en `adapters/`, implementación concreta en el mismo folder, token de
inyección en un `*.constants.ts`, ningún import de la librería concreta fuera
de `adapters/`).

`WhoScoredAdapter` (puerto, `adapters/whoscored-adapter.ts`) expone dos
operaciones, ambas devolviendo datos crudos (posición **sin mapear**, tal como
pide el usuario):

```ts
export interface WhoScoredTeamRef { externalTeamId: string; team: string }

export interface WhoScoredRawPlayer {
  externalId: string;
  name: string;
  rawPosition: string;         // código de WhoScored, sin mapear (GK/DR/DMC/...)
  metrics: WhoScoredRawMetrics | null;  // null = sin partidos en la temporada (legítimo)
  metricsFetchFailed: boolean;          // true = falló la página de stats (FR-018)
}

export interface WhoScoredRawMetrics {
  passesCompleted: number;
  shots: number;
  interceptions: number;
  rating: number;
}

export interface WhoScoredLeagueTeams {
  tournamentId: number;             // id de WhoScored de la liga/temporada
  teams: WhoScoredTeamRef[];
  seedPlayerByTeam: Map<string, string>; // externalTeamId -> externalId de un jugador conocido de ese equipo
}

export interface WhoScoredAdapter {
  /** @throws si no se puede obtener la lista de equipos vigentes de la liga (FR-014 nivel liga) */
  fetchLeagueTeams(league: League): Promise<WhoScoredLeagueTeams>;
  /** @throws si no se puede obtener el plantel del equipo (FR-014 nivel equipo), incluido si vino
   *  vacío. Un fallo puntual de la página de stats de UN jugador no debe propagarse acá: se
   *  refleja como `metricsFetchFailed: true` en ese jugador, sin abortar el resto del plantel. */
  fetchTeamRoster(
    team: WhoScoredTeamRef,
    tournamentId: number,
    seedPlayerId: string,
  ): Promise<WhoScoredRawPlayer[]>;
}
```

**Corrección post-implementación**: la primera versión de este Adapter guardaba
`tournamentId` y `seedPlayerByTeam` como campos de instancia (escritos por
`fetchLeagueTeams`, leídos después por `fetchTeamRoster`/`fetchPlayerMetrics`),
asumiendo implícitamente que nunca habría dos corridas de `sync()` en vuelo al
mismo tiempo sobre el mismo Adapter — un singleton de Nest. Esa asunción no
estaba garantizada por el código (el `@Cron` no tenía `waitForCompletion`), así
que dos corridas solapadas podían pisarse ese estado entre sí (una corrida
leyendo el `tournamentId` que otra ya había sobreescrito). Se corrigió sacando
ambos campos: viajan en el valor de retorno de `fetchLeagueTeams` y como
parámetros explícitos de `fetchTeamRoster` (firma ya actualizada arriba). El
Adapter no tiene ningún campo mutable entre llamadas. El "jugador semilla
faltante para un equipo" pasó de ser un `throw` interno del Adapter a una
validación que hace `PlayerSyncService` antes de llamar a `fetchTeamRoster`
(mismo efecto observable: el equipo se saltea esa corrida). Ver
`contracts/whoscored-adapter.md` § "Sin estado compartido entre llamadas" para
el detalle completo, y `backend/src/adapters/http-whoscored-adapter.spec.ts`
para el test que ejercita dos corridas con `tournamentId` distintos vía
`Promise.all` sobre la misma instancia.

`metrics: null` (temporada sin partidos jugados) y `metricsFetchFailed: true`
(no se pudo obtener/parsear la página) son casos distintos a propósito: el
primero no genera entrada en el log de revisión manual, el segundo sí (spec,
Registro de revisión manual — motivo b). El Adapter es quien distingue ambos
casos porque es quien sabe si hubo una falla técnica o si la página se leyó
bien y simplemente no hay partidos.

`fetchTeamRoster` necesita, para un equipo, tanto la lista del plantel (nombre,
id externo, código de posición) como las métricas por jugador. Un club de una
liga top tiene ~25-30 jugadores en plantel; la implementación concreta hace un
fetch a la página de plantel del equipo (nombre + id externo + posición) y
luego, por jugador, un fetch a su página de `matchstatistics` (FR-003) para las
4 métricas — encapsulado como el detalle interno de `HttpWhoScoredAdapter`, no
parte del contrato del puerto.

**Config interna del Adapter**: WhoScored identifica liga/temporada con ids
numéricos propios (región, torneo, stage), no con el string del enum `League`.
Esa tabla de traducción (5 entradas fijas, liga del dominio → identificadores
de WhoScored) vive **sólo** dentro de `HttpWhoScoredAdapter`; el dominio y el
resto del sistema no conocen esos ids (mismo criterio que ya aplica
`RawApiKey`/`ApiKey`: el dominio no conoce el formato externo).

## §4. Librerías de scraping

**Decisión (revisada post-implementación)**: `got-scraping` (versión
**pinneada exacta** `3.2.15`, no `^3.2.15`) + `cheerio` (parseo de HTML
server-side, jQuery-like, sin cambios).

### Por qué se cambió de `axios` a `got-scraping`

La decisión original de este documento era `axios`. Al implementar y probar
contra el sitio real (no sólo contra los fixtures mockeados) se comprobó que
WhoScored está detrás de Cloudflare con protección anti-bot a nivel de
fingerprint TLS/HTTP2 — `axios` recibía 403 con headers (`User-Agent`,
`Accept`, etc.) idénticos a los de un browser real, mientras que un `curl`
con los mismos headers, en el mismo momento, recibía 200. La causa es el
stack TLS de Node (OpenSSL, orden de cifrados/extensiones del ClientHello),
no algo a nivel HTTP que un header pueda arreglar.

`got-scraping` (Apify) resuelve exactamente ese problema: imita el
ClientHello TLS, el orden de headers y el fingerprint HTTP/2 de un navegador
real. Verificado empíricamente, en un scratch dir aislado del proyecto, antes
de tocar ningún código real, contra los tres tipos de URL reales que este
Adapter consume:

| Tipo de página | Éxitos con `got-scraping` | Éxitos con `axios` |
|---|---|---|
| Liga (`/regions/.../tournaments/...`) | 6/7 en la primera tanda de pruebas | 0/N (403 consistente) |
| Assist-data liga completa (semillas, `.../playerstatistics/...`) | 6/6 | no reprobado, mismo bloqueo esperado |
| Jugador — dropdown de roster (`/players/{id}/show/...`) | 6/6 | no reprobado, mismo bloqueo esperado |
| Jugador — match stats (`/players/{id}/matchstatistics/...`) | 6/6 | no reprobado, mismo bloqueo esperado |

El bypass no es específico de un tipo de página: funciona en los tres flujos
que usa el Adapter (liga, semillas, jugador).

### Por qué la versión está pinneada a `3.2.15` exacta, y qué implica

La rama activa de `got-scraping` (`4.x`, última publicación verificada
2026-02-24) es **ESM-only** (`ERR_PACKAGE_PATH_NOT_EXPORTED` al hacer
`require()`) — este proyecto usa `"module": "commonjs"`, mismo problema ya
resuelto antes con `@nestjs/schedule@12` (§0). `3.2.15` es la **última
versión de la rama `3.x`, publicada el 2023-07-25 y sin releases nuevos desde
entonces** — congelada.

Esa versión carga bien bajo `require()` porque depende de `got-cjs@12.5.4`
(fork de terceros de `got`, publicado por última vez el 2022-11-07, también
sin mantenimiento activo desde entonces) en vez del `got@^14` ESM-only que
usa la rama `4.x` de `got-scraping`. Esto es **una capa extra de dependencia
sin mantenimiento, no sólo una**: tanto `got-scraping@3.2.15` como
`got-cjs@12.5.4`, el paquete del que depende para funcionar en CommonJS,
están congelados.

**Esto no es una solución permanente.** Si Cloudflare/WhoScored actualiza su
detección de fingerprint en el futuro, no hay parches nuevos esperando en
esta rama — toda la evolución posterior de `got-scraping` contra
fingerprinting más nuevo quedó en la rama `4.x` ESM que este proyecto no
puede cargar sin resolver antes la incompatibilidad ESM/CJS.

**El modelo de degradación por niveles (liga/equipo/jugador, FR-014 a
FR-016/FR-018) se mantiene sin cambios y sigue siendo necesario.** La prueba
empírica dio 6/7, no 7/7: un fallo aislado (bloqueo puntual, timeout, cambio
de estructura de página) va a seguir pasando con `got-scraping` igual que
pasaba antes por cualquier otro motivo de red — este cambio de librería baja
la tasa de bloqueo, no la elimina, y el diseño ya asume eso.

### Verificación de statelessness (antes de integrar)

`HttpWhoScoredAdapter` es un singleton de Nest (§3, "Corrección
post-implementación"): ya hubo un bug real de estado mutable compartido entre
corridas concurrentes (`seedPlayerByTeam`/`tournamentId` como campos de
instancia). Antes de adoptar `got-scraping` se revisó su código fuente
instalado (`got-scraping/dist/`) para descartar el mismo problema a nivel del
cliente HTTP:

- **Sin cookie jar**: ningún archivo de `got-scraping` referencia
  `cookieJar`/`CookieJar`/`tough-cookie`. `got`/`got-cjs` soporta uno, pero
  hay que pasarlo explícito — el `get()` de este Adapter no lo hace.
- **El único mecanismo de "sesión" es opt-in y no se usa**:
  `got-scraping/dist/hooks/storage.js` guarda datos por-sesión en un
  `WeakMap` keyeado por `context.sessionToken`, pero si no se pasa
  `sessionToken` (nuestro caso: el `get()` no pasa `context`), la función
  devuelve `undefined` de inmediato sin tocar el `WeakMap`. No hay nada que
  compartir entre llamadas.
- **`gotScraping` es un singleton de módulo con `mutableDefaults: true`**
  (`got-scraping/dist/index.js`), pero eso sólo habilita que alguien *podría*
  mutar `gotScraping.defaults` más adelante (llamando a una API explícita de
  Got para eso) — no significa que cada `.get()` escriba en ese estado
  compartido. El código de este Adapter nunca llama nada de eso, sólo
  `gotScraping.get(url, { timeout })`, que es un merge de opciones por
  request.
- El `HeaderGenerator` compartido y los `agent` de conexión (pooling TCP
  estándar) son infraestructura de sólo lectura por request — no transportan
  datos de negocio de una liga/equipo/jugador a otro.

Conclusión: no hace falta instanciar un cliente nuevo por request ni pasar
ninguna opción extra para neutralizar estado — el uso actual (`get()` sin
`context` ni `cookieJar`) ya es stateless entre llamadas.

### Corrección post-implementación: `throwHttpErrors: false` rompía el guard de nivel liga

`got-scraping` configura `throwHttpErrors: false` (`got-scraping/dist/index.js`)
— a diferencia de `axios`, que rechaza la promesa en cualquier status fuera
de 2xx por default. Un 403 con `got-scraping` resuelve normalmente, con el
HTML de bloqueo de Cloudflare como `body`, en vez de lanzar. Para
`harvestSeedPlayers`/`fetchPlayerMetrics` esto no cambia nada observable: ya
dependían de que `extractEmbeddedArray` tirara si el bloque esperado no
aparece en el HTML, y un HTML de bloqueo tampoco lo tiene. Pero
`fetchLeagueTeams` no tenía ningún guard equivalente: si la página de liga
viene bloqueada, `parseTeamsFromHtml` simplemente no encuentra ningún
`<a href="/teams/...">` y devolvía `[]` **sin lanzar**, lo que
`PlayerSyncService.sync()` leería como "esta liga no tiene equipos" en vez
de como el fallo de nivel liga que FR-014 exige loguear — el mismo tipo de
bug que ya se había corregido para el plantel vacío de un equipo (§ arriba),
ahora a nivel liga. Se agregó el mismo guard: `fetchLeagueTeams` lanza si
`teams.length === 0`, con test dedicado en
`http-whoscored-adapter.spec.ts`.

### Alternativas consideradas

- **Playwright/Puppeteer** (navegador headless): rechazado. WhoScored
  incrusta los datos de partido como JSON dentro de un `<script>` de la propia
  página servida (no requiere ejecutar JavaScript del cliente para verse) —
  consistente con que el pedido pueda usar un fixture HTML *estático*
  capturado una vez y sirva para tests determinísticos sin un browser real.
  Un headless browser sería una dependencia mucho más pesada (proceso Chromium
  en CI) para un problema que `got-scraping + cheerio` ya resuelve, y no
  ataca directamente el problema real (fingerprint TLS/HTTP2 a nivel de
  conexión, no de JS de cliente).
- **`node-fetch`/`fetch` nativo**: no resuelve el problema real (fingerprint
  TLS/HTTP2), que es la razón por la que se descartó `axios` también.
- **Cambiar de fuente de datos** (una API oficial tipo API-Football en vez de
  WhoScored): evaluada y descartada — el requerimiento pide explícitamente
  scraping de WhoScored, no es una decisión técnica abierta.

`got-scraping`/`cheerio` se importan **únicamente** dentro de
`adapters/http-whoscored-adapter.ts`. Se extiende la regla de arquitectura ya
existente en `backend/test/architecture.spec.ts` ("el Service no debe
importar librerías de infraestructura directo") para que además de `bcrypt`
cubra `got-scraping`/`cheerio` — mismo mecanismo, nuevo patrón en la misma
regla.

## §5. Mapeo de posición: función pura en el dominio

`domain/player/whoscored-position-mapping.ts` — función pura
`mapWhoScoredPosition(rawCode: string): Position | undefined`, con la tabla de
la spec (Design Decisions) codificada como constantes:

```ts
GK:  ['GK']
DF:  ['DR', 'DC', 'DL']
MF:  ['DMC', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR']
FW:  ['FWR', 'FW', 'FWL']
```

Devuelve `undefined` (no lanza) para cualquier código fuera de esas 12
entradas: no es un error de validación de input del cliente (como
`parsePosition` sobre un query param), es la política de negocio "excluir e
loguear" (FR-012) que decide `PlayerSyncService`, no una excepción de dominio.
Se ubica junto a `position.ts` (mismo folder) pero en archivo propio porque es
una tabla de datos externa (WhoScored), no una regla intrínseca del enum
`Position` en sí.

**Alternativa rechazada**: extender `parsePosition` para aceptar también
códigos de WhoScored. Mezclaría dos responsabilidades distintas (validar un
filtro de API vs. traducir una taxonomía externa) en la misma función.

## §6. Volumen, timeout y solapamiento de corridas

**Scale/Scope estimado**: 5 ligas × ~18-20 equipos × ~25-30 jugadores de
plantel ≈ 2500-3000 páginas de `matchstatistics` por corrida completa, más
~100 páginas de plantel de equipo y 5 de lista de equipos por liga. No es un
requisito de performance de la spec (SC-005 de `004` no aplica acá: nada de
esto ocurre en el camino de una request de cliente, FR-008/FR-009), es
puramente el volumen de trabajo en background de una corrida semanal.

**Timeout**: cada request HTTP del Adapter usa un timeout fijo de 15000 ms
(`WHOSCORED_REQUEST_TIMEOUT_MS`, en `player-sync.constants.ts`). Vencido el
timeout, ese fetch se trata igual que cualquier otro fallo de red en su nivel
(liga/equipo → salta esa unidad, FR-014/015; jugador puntual →
`metricsFetchFailed: true`, FR-018).

**Solapamiento de corridas — corrección post-implementación**: la versión
original de este research.md daba por sentado que solapar dos corridas de
`sync()` era, en el peor caso, inofensivo ("upserts redundantes, no
corrupción"), y que por eso no hacía falta ningún lock. Eso era **incorrecto**:
`HttpWhoScoredAdapter` guardaba `tournamentId`/`seedPlayerByTeam` como campos
de instancia, y dos corridas solapadas sobre el mismo singleton sí podían
pisarse ese estado — una corrida de una liga podía terminar leyendo el
`tournamentId` que otra corrida, sincronizando otra liga en simultáneo, ya
había sobreescrito. El síntoma no era un error visible: un jugador con stats
reales en su competencia podía terminar con métricas en `null` porque el
filtro de temporada usó el `tournamentId` equivocado, sin lanzar excepción ni
loguearse en ningún lado. Se corrigió en dos frentes (ver §3, "Corrección
post-implementación", y `contracts/whoscored-adapter.md`):

1. **La solución de fondo**: sacar todo el estado mutable del Adapter.
   `tournamentId` y `seedPlayerByTeam` ahora viajan por el valor de retorno de
   `fetchLeagueTeams` y como parámetros explícitos de `fetchTeamRoster`; el
   Adapter no tiene ningún campo entre llamadas más allá del `logger`. Dos
   corridas —solapadas o no— ya no tienen ningún dato compartido que puedan
   pisarse.
2. **Defensa en profundidad**: `PlayerSyncService.sync()` usa
   `@Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })`, para que
   el propio scheduler tampoco dispare una corrida nueva mientras la anterior
   sigue corriendo. Esto reduce todavía más la chance de que dos corridas
   lleguen a ejecutarse en simultáneo, pero no es la garantía real: la
   garantía real es (1).

La estimación de volumen/duración de la corrida (arriba) no cambia: sigue
siendo la razón por la que una corrida podría en teoría extenderse más de lo
esperado, sólo que ahora eso ya no es peligroso aunque ocurra.

## §7. Frecuencia del scheduler

**Decisión**: `@Cron(CronExpression.EVERY_WEEK)` (provisto por
`@nestjs/schedule`, corre los domingos a medianoche), pedido explícito del
usuario ("una vez por semana"). La spec (`006`) dejó la frecuencia exacta como
detalle de implementación a resolver acá — queda resuelta con esta decisión.

## §8. Determinismo de tests: fixture HTML capturado, no el sitio real

**Decisión**: se captura y versiona un HTML real de una página de
`matchstatistics` de WhoScored (`backend/test/fixtures/whoscored/`) para los
tests del Adapter. `HttpWhoScoredAdapter` recibe el HTML vía
`gotScraping.get(...)`; en los tests unitarios del Adapter, `got-scraping` se
mockea (`jest.mock('got-scraping', () => ({ gotScraping: { get: jest.fn() } }))`)
para resolver con el contenido del fixture leído del disco, ejercitando el
parseo real (`cheerio`) sin red. Esto es exactamente el mismo criterio que la
constitución exige para el `httpClient` del frontend (Principio IX: mockear la
llamada de red, no la capa de arriba) aplicado al lado backend/Adapter.

Para `PlayerSyncService`, la orquestación (niveles liga/equipo/jugador,
mapeo, log de revisión manual, upsert/baja) se testea con un
`WhoScoredAdapter` fake (no HTTP, no fixture) que devuelve datos ya "parseados"
fijos y deterministas — el fixture HTML es responsabilidad exclusiva de los
tests del Adapter concreto, no de `PlayerSyncService` (mismo criterio de capas
que ya separa `PlayerService.spec.ts` con repo mockeado de
`player.service.integration.spec.ts` contra Postgres real).

## §9. Log de revisión manual: logging estructurado, no una tabla nueva

La spec (Assumptions) deja explícito que el formato de almacenamiento del log
de revisión manual es un detalle de implementación a resolver acá.

**Decisión**: logging estructurado vía `Logger` de NestJS (mismo mecanismo que
ya exige el Principio VII y que ya usa `AllExceptionsFilter`), con un logger
nombrado (`new Logger('PlayerSyncManualReview')`) y un objeto estructurado por
entrada: `{ reason: 'unrecognized-position' | 'stats-fetch-failed',
whoScoredPlayerId, name, team, league, rawPosition? }`. No se crea una tabla
nueva: agregaría persistencia y un endpoint/consulta que nadie pidió, para un
caso de uso ("alguien lo revisa manualmente") que ya cubre buscar en los logs
estructurados existentes.

**Alternativa rechazada**: tabla `player_sync_review_log`. Sobre-ingeniería
para el alcance pedido; se reconsideraría si en el futuro se pidiera una
pantalla o endpoint de revisión, que esta feature no pide.
