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

export interface WhoScoredAdapter {
  /** @throws si no se puede obtener la lista de equipos vigentes de la liga (FR-014 nivel liga) */
  fetchLeagueTeams(league: League): Promise<WhoScoredTeamRef[]>;
  /** @throws si no se puede obtener el plantel del equipo (FR-014 nivel equipo). Un fallo
   *  puntual de la página de stats de UN jugador no debe propagarse acá: se refleja como
   *  `metricsFetchFailed: true` en ese jugador, sin abortar el resto del plantel. */
  fetchTeamRoster(team: WhoScoredTeamRef): Promise<WhoScoredRawPlayer[]>;
}
```

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

**Decisión**: `axios` (cliente HTTP, con `timeout` configurado — ver §6) +
`cheerio` (parseo de HTML server-side, jQuery-like). Ninguna de las dos es
nueva en el ecosistema Node/NestJS del proyecto.

**Alternativas consideradas**:
- **Playwright/Puppeteer** (navegador headless): rechazado. WhoScored
  incrusta los datos de partido como JSON dentro de un `<script>` de la propia
  página servida (no requiere ejecutar JavaScript del cliente para verse) —
  consistente con que el pedido pueda usar un fixture HTML *estático*
  capturado una vez y sirva para tests determinísticos sin un browser real.
  Un headless browser sería una dependencia mucho más pesada (proceso Chromium
  en CI) para un problema que `axios + cheerio` resuelve.
- **`node-fetch`/`fetch` nativo en vez de `axios`**: viable, pero `axios` ya
  da `timeout` y manejo de errores de red en una sola opción de config, sin
  wrapping manual.

Ambas se importan **únicamente** dentro de `adapters/http-whoscored-adapter.ts`.
Se extiende la regla de arquitectura ya existente en
`backend/test/architecture.spec.ts` ("el Service no debe importar librerías de
infraestructura directo") para que además de `bcrypt` cubra
`axios`/`cheerio` — mismo mecanismo, nuevo patrón en la misma regla.

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

## §6. Volumen, timeout y ausencia de lock de solapamiento

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

**Solapamiento de corridas**: no se agrega ningún mecanismo de lock/mutex entre
corridas de `@Cron`. Con una cadencia semanal (§7) y una corrida completa que,
aun en el peor caso, se espera que tome un orden de horas (no días), la
probabilidad de que la corrida programada de la semana siguiente arranque
mientras la anterior sigue viva es despreciable, y agregar un lock distribuido
sería complejidad no pedida por la spec ni por el usuario para un caso límite
sin evidencia de que vaya a ocurrir. Si en la práctica llegara a solaparse, el
peor caso es upserts redundantes sobre el mismo equipo, no corrupción: cada
`applyTeamRosterSync` sigue siendo una transacción atómica por equipo.

## §7. Frecuencia del scheduler

**Decisión**: `@Cron(CronExpression.EVERY_WEEK)` (provisto por
`@nestjs/schedule`, corre los domingos a medianoche), pedido explícito del
usuario ("una vez por semana"). La spec (`006`) dejó la frecuencia exacta como
detalle de implementación a resolver acá — queda resuelta con esta decisión.

## §8. Determinismo de tests: fixture HTML capturado, no el sitio real

**Decisión**: se captura y versiona un HTML real de una página de
`matchstatistics` de WhoScored (`backend/test/fixtures/whoscored/`) para los
tests del Adapter. `HttpWhoScoredAdapter` recibe el HTML vía `axios.get(...)`;
en los tests unitarios del Adapter, `axios` se mockea (`jest.mock('axios')`)
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
