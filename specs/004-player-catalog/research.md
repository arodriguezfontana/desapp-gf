# Phase 0 — Research: Catálogo de Jugadores (datos de prueba)

Todas las decisiones abajo resuelven los puntos del Technical Context que no eran
directamente el pedido literal del usuario. Ninguna queda abierta.

---

## 1. `ApiKeyGuard`: por qué no puede ser un segundo `APP_GUARD` global

**Decisión**: `ApiKeyGuard` se aplica con `@UseGuards(ApiKeyGuard)` sobre
`PlayerController` (o sus handlers), **no** se registra como `APP_GUARD` global. El
controller se marca además `@Public()` para eximirlo del `JwtAuthGuard` global
existente.

**Rationale**: NestJS ejecuta **todos** los guards de tipo `APP_GUARD` en cadena, y
**todos** deben devolver `true` para que la request pase (es AND, no OR). Si
`ApiKeyGuard` se registrara como un segundo `APP_GUARD` global junto al
`JwtAuthGuard` ya existente:
- Cualquier endpoint público hoy (`/auth/register`, `/auth/login`, `GET /`,
  `GET /health`) empezaría a exigir también una ApiKey, rompiéndolos.
- El propio catálogo terminaría exigiendo **JWT Y ApiKey a la vez** (porque
  `JwtAuthGuard` seguiría corriendo primero salvo que también se marque
  `@Public()` — y aun marcado `@Public()`, un segundo guard global sigue
  ejecutándose para *todos* los endpoints, incluidos los que no deberían llevar
  ApiKey en absoluto).

Marcar sólo `PlayerController` como `@Public()` (bypass del `JwtAuthGuard`) y
protegerlo aparte con `@UseGuards(ApiKeyGuard)` (guard de ruta, no global) da
exactamente la semántica pedida: estos dos endpoints exigen ApiKey y **nada más**;
el resto del sistema sigue exigiendo JWT sin cambios.

**Alternativas consideradas**:
- `ApiKeyGuard` como `APP_GUARD` adicional: descartado por lo anterior (AND en vez
  de OR entre guards globales de Nest).
- Un único guard combinado "JWT o ApiKey" aplicado globalmente: descartado, over-
  engineering para dos endpoints, y la spec pide explícitamente que **no** se acepte
  JWT como alternativa en el catálogo — un guard combinado iría en contra de eso.

---

## 2. Cómo cargar el seed vía migration sin tocar `database.module.ts`

**Decisión**: la migration **no** se ejecuta a través del `DataSource` que gestiona
`TypeOrmModule.forRootAsync` (ese sigue con `synchronize` fuera de producción, sin
`migrations` ni `migrationsRun` configurados — cero cambios ahí). En su lugar:

1. `backend/src/database/player-catalog-data-source.ts` exporta un `DataSource`
   **standalone**, construido a mano con `{ type: 'postgres', url:
   process.env.DATABASE_URL, migrations: ['dist/database/migrations/*.js'] }`
   (o el glob `.ts` equivalente bajo `ts-node` para el CLI en dev). No registra
   entidades: la migration usa `queryRunner.query(...)` con SQL crudo, no el
   Repository pattern.
2. `backend/src/database/run-player-catalog-migrations.ts` expone una función que
   inicializa ese `DataSource`, llama a `.runMigrations()` (TypeORM lleva su propia
   tabla `migrations` y no reaplica lo ya corrido) y lo destruye.
3. Esa función se invoca desde dos lugares, ambos **después** de que el `DataSource`
   real de la app ya sincronizó el esquema (porque `synchronize` corre como parte de
   `NestFactory.create()` / `Test.createTestingModule(...).compile()`, antes de que
   el bootstrap siga):
   - `main.ts`, justo después de `NestFactory.create(AppModule)` y antes de
     `app.listen()` (cubre dev, CI del build real, y producción si algún día aplica).
   - `backend/test/test-app.ts`, dentro de `createTestApp()`, justo después de
     `app.init()` (cubre los e2e, que son los únicos tests que necesitan el catálogo
     de 20 jugadores real).
4. `backend/package.json` gana dos scripts (`migration:run`, `migration:generate`)
   que usan el binario `typeorm-ts-node-commonjs` ya presente contra ese mismo
   `player-catalog-data-source.ts`, para uso manual en desarrollo si hiciera falta
   re-generar o inspeccionar la migration.

**Rationale**: el pedido es explícito en dos puntas que a primera vista tensionan:
"no hay que tocar la configuración de TypeORM" y "cargar los 20 jugadores con una
migration". La tensión se resuelve porque son dos `DataSource` distintos con
responsabilidades distintas — el de la app (`database.module.ts`, sin tocar seguirá
resolviendo conexión + `synchronize` para todas las entidades, `players` incluida) y
uno nuevo, aislado, cuya única función es correr esta migration puntual. Este es
además el patrón estándar de TypeORM + NestJS: `TypeOrmModule.forRootAsync` usa una
factory async que el CLI de TypeORM no puede introspectar, por lo que cualquier
proyecto que quiera migrations junto con `forRootAsync` necesita igual un
`DataSource` de archivo plano para el CLI.

Los tests de integración (`player.service.integration.spec.ts`,
`api-key.service.integration.spec.ts` ya existente) **no** llaman a este runner:
insertan sus propios fixtures directamente contra la tabla (mismo patrón que
`api-key.service.integration.spec.ts` ya usa), porque prueban la lógica de filtros/
paginación del repositorio, no el contenido específico del catálogo de 20 jugadores.

**Alternativas consideradas**:
- Agregar `migrations`/`migrationsRun: true` al `useFactory` de
  `TypeOrmModule.forRootAsync` en `database.module.ts`: descartado, es exactamente
  la configuración que el pedido dijo no tocar, y además acoplaría el ciclo de vida
  de *todas* las conexiones de la app (incluyendo tests de integración de
  `ApiKeyService` que importan `DatabaseModule` directo) a esta migration puntual.
- Seed vía un `OnApplicationBootstrap` que hace `INSERT` con el Repository si la
  tabla está vacía: es el "seed script en runtime" que el pedido descartó
  explícitamente ("no un seed script en runtime").
- Correr la migration sólo manualmente (`pnpm migration:run`) sin invocarla desde
  `main.ts`/`test-app.ts`: descartado para CI/Testcontainers, porque cada corrida usa
  una base efímera nueva y nadie ejecutaría el comando a mano; automatizarla dentro
  del bootstrap es lo que garantiza "que corra igual en local y en CI" (pedido
  explícito del usuario).
- Migrar también `users`/`api_keys` a migrations formales ahora, ya que se introduce
  la infraestructura: fuera de alcance de esta feature (esas tablas siguen con
  `synchronize`, sin cambios); tocarlas es una decisión aparte que no pidió el
  usuario y que ampliaría el blast radius de este plan sin necesidad.

---

## 3. `ApiKeyGuard` no reusa `RawApiKey.of()` para el formato

**Decisión**: `ApiKeyGuard` toma el valor crudo del header `x-api-key` como
`string` y lo hashea directo con `TokenHasher.hash()` (mismo `Sha256TokenHasher` ya
usado por `ApiKeyService`), sin pasar por `RawApiKey.of()`.

**Rationale**: `RawApiKey.of()` valida el formato (`pmk_` + 64 hex) y **lanza
`InvalidApiKeyFormatError`** si no matchea — error que `AllExceptionsFilter` ya
mapea explícitamente a **400**. Pero la spec de esta feature (FR-012, User Story 3)
pide **401** para *cualquier* ApiKey inválida, incluida una corrompida o mal
formada — no distingue "formato inválido" de "no existe". Reusar `RawApiKey.of()`
en el guard filtraría un 400 donde debe haber 401. La solución más simple es no
validar formato en absoluto en el guard: si el string no tiene el formato esperado,
su hash SHA-256 simplemente no va a matchear ningún `key_hash` guardado, y
`findByHash` devuelve `null` → 401 igual, sin necesitar la validación de formato.

**Alternativas consideradas**:
- Envolver `RawApiKey.of()` en un `try/catch` dentro del guard y convertir
  `InvalidApiKeyFormatError` a `UnauthorizedException`: funciona, pero agrega
  código para reimplementar algo que el hash-lookup ya resuelve gratis. Se descarta
  por simplicidad (menos código, mismo resultado observable).

---

## 4. Extensión de "enum en dominio, no en DTO" de posición a liga

**Decisión**: tanto `league` como `position` en `ListPlayersQueryDto` quedan como
`string` opcional simple (`@IsOptional() @IsString()`), sin `@IsEnum()`. La
membresía en el enum correspondiente se valida en el Controller al construir el
filtro de dominio (`parseLeague(dto.league)` / `parsePosition(dto.position)`),
lanzando `InvalidLeagueError`/`InvalidPositionError` (ambos `DomainError`, ambos
caen en la rama genérica 400 del `AllExceptionsFilter`, sin necesidad de agregar
ninguna rama nueva para ellos).

**Rationale**: el pedido sólo menciona esto explícitamente para posición ("La
posición valida contra el enum propio GK/DF/MF/FW en el dominio, no en el DTO"),
pero liga es exactamente el mismo tipo de validación (membresía en un conjunto fijo
de 5 valores) con el mismo rationale (Principio II: la regla de "qué es una liga/
posición válida" vive en un solo lugar, el dominio, reusable si en el futuro otro
flujo la necesita). Tratarlas distinto sería inconsistente sin una razón que lo
justifique.

**Alternativas consideradas**:
- `@IsEnum(League)` / dejar liga en el DTO y sólo posición en dominio: descartado
  por la inconsistencia señalada arriba; el pedido no da ninguna razón para tratar
  liga distinto de posición.

---

## 5. Nombre del header de ApiKey: `x-api-key`

**Decisión**: `x-api-key` (minúsculas, como llega normalizado por Express/Node en
`request.headers`).

**Rationale**: es el nombre que la propia spec de `002-api-key-issuance` ya sugiere
en su texto de Assumptions ("cabeceras `x-api-key` o similar") como el mecanismo
esperado para features que consuman la ApiKey; es además la convención de facto de
la industria para este tipo de credencial (distinta de `Authorization: Bearer`, que
ya está tomado por JWT en este sistema). Se define como constante
`API_KEY_HEADER = 'x-api-key'` en `api-key.constants.ts` (junto a `API_KEY_PREFIX`)
para que cualquier feature futura que también necesite ApiKey lo reuse sin
inventarlo de nuevo.

**Alternativas consideradas**:
- Reusar `Authorization` con un scheme propio (`Authorization: ApiKey <valor>`):
  descartado, mezclaría semánticamente dos mecanismos de auth distintos en el mismo
  header y complicaría distinguir "vino un JWT" de "vino una ApiKey" en herramientas
  como Swagger UI.

---

## 6. Datos de la migration: nombres, ids y esquema de la tabla

**Decisión**: ver [data-model.md](./data-model.md) para la lista completa de los 20
jugadores. Cada fila usa un UUID **literal fijo** (generado una vez al escribir la
migration, no `gen_random_uuid()` en cada corrida) para que el catálogo sea
determinístico entre corridas de Testcontainers y entornos. La tabla `players` usa
columnas `varchar` simples para `league`/`team`/`position` (no un tipo `enum` nativo
de Postgres): el dominio (`League`/`Position`) ya es la única fuente de verdad sobre
qué valores son válidos (research.md §4); un `CHECK`/`enum` de Postgres duplicaría
esa regla en dos lugares sin necesidad, para un catálogo de 20 filas fijas que no se
edita vía API.

**Rationale**: UUIDs fijos hacen que los e2e puedan referenciar ids conocidos si
hace falta (por ejemplo, para el caso "detalle con id existente") sin depender de
leer primero el listado. Evitar un enum nativo de Postgres mantiene la migration
simple y evita que agregar una liga o posición en el futuro requiera una migration
de `ALTER TYPE` además de un cambio de código.

**Alternativas consideradas**:
- UUIDs generados en cada corrida de la migration (`gen_random_uuid()` en el
  `INSERT`): descartado, rompe la reproducibilidad entre corridas (cada
  Testcontainers levantaría ids distintos, dificultando tests e2e que quieran fijar
  un id conocido en sus asserts).
- Tipo `enum` nativo de Postgres para `league`/`position`: descartado por lo
  señalado arriba (duplica la regla de validación en DB + dominio sin necesidad).
