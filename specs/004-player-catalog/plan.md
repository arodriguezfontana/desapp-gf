# Implementation Plan: Catálogo de Jugadores (datos de prueba)

**Branch**: `feat/catalogo` | **Feature dir**: `specs/004-player-catalog/` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-player-catalog/spec.md`

## Corrección a las precondiciones del pedido

El pedido de este plan afirmaba que **"el ApiKeyGuard ya existe, se reusa tal cual"**.
Al revisar `backend/src/guards/` (rama `feat/catalogo`, que ya tiene mergeadas
`001-user-auth` y `002-api-key-issuance`) esto **no es así**: sólo existe
`JwtAuthGuard`. La spec de `002-api-key-issuance` ya dejaba esto explícito en sus
Assumptions: *"el consumo y validación de la ApiKey en otros endpoints... será
abordado por features o contratos específicos que la utilicen"* — es decir, esta
feature. Confirmado con el usuario, este plan **crea** `ApiKeyGuard` como parte de su
alcance (ver Constitution Check, Principio IV, y research.md §1).

El resto de las precondiciones del pedido sí se verificaron correctas: TypeORM
configurado y apuntando a `desapp` vía `DATABASE_URL` (`database.module.ts`, sin
tocar), `docker-compose.yml` de Postgres existente, `AllExceptionsFilter` global
existente (sólo se le agrega un `instanceof` más), sin variables de entorno nuevas.

## Summary

Exponer un catálogo de jugadores de solo lectura (`GET /players`, `GET /players/:id`)
sobre 20 jugadores ficticios cargados una única vez vía una migration formal de
TypeORM (una por cada combinación de las 5 ligas × 4 posiciones). El listado filtra
por liga, equipo y posición (AND) y pagina (`page`/`pageSize`) resolviendo todo contra
Postgres (`WHERE` + `LIMIT/OFFSET`) en el `PlayerRepository`, nunca en memoria. Ambos
endpoints quedan detrás de un `ApiKeyGuard` nuevo (header `x-api-key`, reusando el
hasher y el repositorio de ApiKeys de `002-api-key-issuance`) y exentos del
`JwtAuthGuard` global vía `@Public()`, de forma que un JWT válido nunca alcanza para
entrar. La posición y la liga se validan como invariante de dominio (no en el DTO),
lanzando errores de dominio que el filtro global ya mapea a 400 por su rama genérica.
Se agrega `PlayerNotFoundError` → 404 al `AllExceptionsFilter` existente.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20, NestJS 11 (stack ya en uso; sin cambios).

**Primary Dependencies**: ninguna dependencia nueva de `npm`. Se reutilizan
`@nestjs/typeorm`/`typeorm`, `class-validator`/`class-transformer`, `@nestjs/swagger`,
y el binario `typeorm-ts-node-commonjs` (ya presente en `node_modules/.bin`, viene con
`typeorm`) para correr la migration de seed vía CLI.

**Storage**: PostgreSQL vía TypeORM, misma base `desapp` y misma `DATABASE_URL` que ya
usan `users` y `api_keys` (`database.module.ts` **no se toca**). Tabla nueva: `players`
(20 filas fijas, sólo insertadas por la migration de esta feature).

**Testing**: Jest + supertest + Testcontainers (patrón ya establecido en el proyecto:
`backend/test/setup/`). Unit de dominio (`League`, `Position`, `Player`) sin Nest ni
DB; unit de `PlayerService` con repo mockeado; integración de `TypeOrmPlayerRepository`
+ `PlayerService` contra Postgres efímero (fixtures propios, no depende del seed);
e2e con la app completa (que sí corre la migration de seed) verificando las 20
combinaciones, paginación, filtros vacíos, 404 y los cuatro casos de `ApiKeyGuard`.

**Target Platform**: mismo backend server (API REST), sin cambios de plataforma.

**Project Type**: Web — monorepo `backend/` + `frontend/`. Esta feature es
**backend-only**: la spec no menciona UI ni un consumidor humano, sólo "un cliente
integrador" con ApiKey (ver spec, User Story 1/2). El consumo desde el frontend, si
llega a existir, es una feature futura separada (mismo patrón que 001 → 002 → 003).

**Performance Goals**: sin metas especiales más allá de SC-005 de la spec (< 1s), trivial
con 20 filas. El mandato de resolver filtros/paginación en Postgres (no en memoria) es
una decisión de arquitectura del pedido, no una necesidad de performance a este volumen.

**Constraints**:
- `ApiKeyGuard` nuevo, aplicado a nivel de controller (no como `APP_GUARD` global —
  ver research.md §1 para por qué eso rompería el resto del sistema).
- Liga y posición se validan como enum de dominio, no con `@IsEnum()` en el DTO
  (pedido explícito del usuario para posición; se extiende a liga por simetría — ver
  research.md §4).
- La migration de seed sólo inserta datos; el esquema de `players` lo sigue creando
  `synchronize` (igual que `users`/`api_keys` hoy) — no se activa `migrationsRun` en
  `database.module.ts` (ver research.md §2).
- Sin variables de entorno nuevas, sin cambios a `.env.example`.

**Scale/Scope**: 1 tabla nueva (20 filas fijas), 2 endpoints, 1 guard nuevo, 1
migration + su DataSource de CLI, ~20 archivos nuevos y 6 archivos existentes con un
cambio puntual cada uno.

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado tras Phase 1. Constitución v1.8.0.*

| # | Principio | Estado | Cómo se cumple / nota |
|---|-----------|--------|-----------------------|
| I | Arquitectura en capas | ✅ | `PlayerController` sólo llama a `PlayerService`. DTOs viven en el Controller y se convierten a objetos de dominio (`League`/`Position`/filtros) antes de delegar. `PlayerService` recibe/devuelve objetos de dominio, nunca `PlayerEntity`. `TypeOrmPlayerRepository` es el único lugar donde conviven `Player` (dominio) y `PlayerEntity` (persistencia), vía `PlayerMapper` sin lógica de negocio. No hay proveedor externo ni librería de infraestructura nueva que aislar en un Adapter: el hasheo de ApiKey ya está detrás de `TokenHasher` (reusado, no nuevo). |
| II | Modelo de dominio rico | ✅ (alcance acotado) | `League`/`Position` son los enums de dominio; su membresía se valida ahí (`parseLeague`/`parsePosition`), no en el Controller ni el DTO. No hay cálculo de score de valuación ni Strategy pattern: esta feature no toca valuación, sólo expone datos de referencia. |
| III | Cada validación en su nivel | ✅ | **DTO** (`class-validator`): forma de `page`/`pageSize` (enteros, `page ≥ 1`, `1 ≤ pageSize ≤ 50`) — son datos de forma, no invariantes de negocio. **Service**: existencia del jugador pedido por id (`PlayerNotFoundError` si no existe). **Dominio**: membresía de `liga`/`posición` en su enum (`InvalidLeagueError`/`InvalidPositionError`). El `AllExceptionsFilter` existente ya mapea cualquier `DomainError` no listado explícitamente a 400 (cubre los dos de arriba sin tocar el filtro); se agrega **una** rama nueva explícita para `PlayerNotFoundError` → 404 (pedido explícito del usuario). |
| IV | Autenticación | ✅ (interpretación explícita, ver spec § Design Decisions) | El listado y el detalle exigen `ApiKey` (header `x-api-key`), no JWT. Esto es consistente con la letra del principio: el requisito de JWT rige para operaciones que necesitan saber **qué usuario** opera; leer el catálogo no depende de una identidad de usuario, sino de que quien llama sea un cliente autorizado (mismo criterio ya usado para emitir la propia ApiKey en `002`). Mecanismo: `@Public()` exime a `PlayerController` del `JwtAuthGuard` global, y un `ApiKeyGuard` nuevo —aplicado sólo en ese controller, **no** como `APP_GUARD` global— exige la ApiKey. Un JWT válido sin `x-api-key` sigue dando 401 (FR-012, User Story 3). **Nota**: `ApiKeyGuard` no existía en el código pese a la precondición del pedido; se crea acá (ver arriba, "Corrección a las precondiciones"). |
| V | Auditoría inmutable | N/A | No hay compra/venta de tokens en esta feature; el catálogo es de sólo lectura. |
| VI | Integridad transaccional | N/A | Sin escrituras vía API. La migration de seed es un único `INSERT` idempotente, no concurrente con operaciones de negocio. |
| VII | Observabilidad | ⚠️ Deuda preexistente, no introducida acá | Logs estructurados, Correlation-ID y métricas siguen diferidos desde `001-user-auth` (Complexity Tracking de esa spec). Esta feature no la agrava ni la resuelve; `GET /health` ya existe. |
| VIII | Documentación de la API | ✅ | `@nestjs/swagger` sobre `PlayerController`/DTOs. Se agrega un esquema de seguridad `ApiKeyAuth` (`addApiKey` en `main.ts`) y `@ApiSecurity('ApiKeyAuth')` en el controller — mismo patrón que `addBearerAuth()`. OpenAPI generado, no escrito a mano. |
| IX | Testing | ✅ | Unit de dominio sin Nest/DB (`League`, `Position`, `Player`, `player-not-found.error`). Unit de `PlayerService` con repo mockeado. Integración de `TypeOrmPlayerRepository` contra Postgres real (Testcontainers) con fixtures propios. e2e sobre la app completa (con migration de seed corrida) cubriendo las 20 combinaciones liga+posición, paginación, filtros sin resultados, 404 y los 4 casos de `ApiKeyGuard`. El test de arquitectura (`tsarch`) ya es genérico por carpeta (`controllers/`, `services/`, `domain/`, `repositories/`) y cubre `PlayerModule` sin modificarlo. |
| X | Definición de terminado | ✅ | Contempla tests unit+integración+e2e en verde, `nest build` sin errores, Swagger actualizado con `GET /players` y `GET /players/:id`, y la colección Postman actualizada con ambos requests + header `x-api-key`. |
| XI | Idioma | ✅ | Identificadores en inglés (`Player`, `League`, `Position`, `PlayerService`, `findPage`). Mensajes de error y campos conceptuales de la spec en español; el contrato JSON usa nombres en inglés (`league`, `team`, `position`) siguiendo el mismo criterio que `IssueApiKeyResponseDto` en `002` (identificadores de código, aunque viajen en el JSON, son identificadores). |
| XII | Spec-first | ✅ | Deriva de `specs/004-player-catalog/spec.md`; toda ambigüedad ya quedó como decisión explícita ahí (Design Decisions, Assumptions). |

**Resultado del gate**: PASA. Sin violaciones que requieran justificación en
Complexity Tracking más allá de las decisiones ya registradas arriba (todas
consistentes con la letra y el rationale de la constitución, no en tensión con ella).

## Project Structure

### Documentation (this feature)

```text
specs/004-player-catalog/
├── plan.md              # Este archivo
├── spec.md              # Especificación (ya existe)
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md         # Phase 1 — entidades, enums, seed de 20 jugadores
├── quickstart.md        # Phase 1 — guía de validación end-to-end
├── contracts/
│   └── player-api.md    # Contrato REST de GET /players y GET /players/:id
├── checklists/
│   └── requirements.md  # (ya existe)
└── tasks.md              # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── package.json                                    # + scripts migration:run / migration:generate
└── src/
    ├── main.ts                                      # + runPlayerCatalogMigrations() antes de listen(); + addApiKey() en Swagger
    ├── app.module.ts                                # + import PlayerModule
    ├── api-key.constants.ts                         # + API_KEY_HEADER = 'x-api-key'
    ├── api-key.module.ts                             # + exports: [API_KEY_REPOSITORY, TOKEN_HASHER] (para que PlayerModule los reuse)
    ├── player.module.ts                              # NUEVO — importa ApiKeyModule + TypeOrmModule.forFeature([PlayerEntity])
    ├── player.constants.ts                           # NUEVO — PLAYER_REPOSITORY = Symbol(...)
    ├── domain/
    │   └── player/
    │       ├── league.ts                             # NUEVO — enum League + parseLeague()
    │       ├── position.ts                           # NUEVO — enum Position + parsePosition()
    │       ├── player.ts                              # NUEVO — clase de dominio (id, name, league, team, position)
    │       ├── league.spec.ts
    │       ├── position.spec.ts
    │       ├── player.spec.ts
    │       └── errors/
    │           ├── invalid-league.error.ts           # NUEVO
    │           ├── invalid-position.error.ts         # NUEVO
    │           └── player-not-found.error.ts         # NUEVO
    ├── repositories/
    │   ├── player.repository.ts                       # NUEVO — puerto (interface)
    │   ├── typeorm-player.repository.ts                # NUEVO — WHERE + LIMIT/OFFSET
    │   ├── entities/
    │   │   └── player.entity.ts                       # NUEVO — @Entity('players')
    │   └── mappers/
    │       └── player.mapper.ts                        # NUEVO
    ├── services/
    │   ├── player.service.ts                           # NUEVO — listPlayers / getPlayerById
    │   ├── player.service.spec.ts
    │   └── player.service.integration.spec.ts           # contra Postgres real, fixtures propios
    ├── controllers/
    │   ├── player.controller.ts                         # NUEVO — GET /players, GET /players/:id
    │   └── dto/
    │       └── player/
    │           ├── list-players-query.dto.ts            # NUEVO
    │           ├── player-response.dto.ts                # NUEVO
    │           └── player-list-response.dto.ts            # NUEVO
    ├── guards/
    │   ├── api-key.guard.ts                              # NUEVO — reusa TokenHasher + ApiKeyRepository existentes
    │   └── api-key.guard.spec.ts
    ├── shared/filters/
    │   └── all-exceptions.filter.ts                      # + 1 rama: PlayerNotFoundError -> 404
    └── database/
        ├── player-catalog-data-source.ts                 # NUEVO — DataSource standalone SOLO para CLI/migration (no toca database.module.ts)
        ├── run-player-catalog-migrations.ts                # NUEVO — helper compartido por main.ts y test-app.ts
        └── migrations/
            └── <timestamp>-SeedPlayerCatalog.ts             # NUEVO — INSERT idempotente de los 20 jugadores

backend/test/
├── test-app.ts                                        # + runPlayerCatalogMigrations(dataSource) después de app.init()
└── player-catalog.e2e-spec.ts                           # NUEVO

docs/postman/desapp.postman_collection.json               # + GET /players, GET /players/:id (header x-api-key)
```

**Structure Decision**: Monorepo web existente; feature **backend-only** en
`backend/`. Se sigue la organización real por capa ya vigente en `backend/src/`
(`controllers/`, `services/`, `domain/<feature>/`, `repositories/`, `guards/`) —no la
estructura anidada `modules/<feature>/` que 001 dibujó originalmente en su plan pero
que el código terminó no adoptando—, más un `player.module.ts` y `player.constants.ts`
a nivel raíz de `src/`, igual que `auth.module.ts`/`api-key.module.ts`. La
infraestructura de migration (`database/migrations/`, `player-catalog-data-source.ts`)
es nueva para el proyecto (primera vez que se usan migrations formales) pero vive
aislada de `database.module.ts`, que no se modifica.

## Complexity Tracking

> No hay violaciones del Constitution Check que requieran esta tabla. Las decisiones
> con más superficie (ApiKeyGuard nuevo, migration formal, validación de enum en
> dominio) están evaluadas arriba como consistentes con la constitución, no como
> desviaciones que necesiten una alternativa más simple descartada.

## Phase 0 — Research

Ver [research.md](./research.md). Resuelve: por qué `ApiKeyGuard` no puede ser un
segundo `APP_GUARD` global, cómo correr una migration de seed sin tocar
`database.module.ts`, por qué el guard no reusa `RawApiKey.of()` para el formato,
la extensión de "enum en dominio, no en DTO" de posición a liga, y el nombre del
header (`x-api-key`).

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): entidad `Player`, enums `League`/`Position`,
  tabla `players`, y la lista concreta de los 20 jugadores de la migration de seed
  (uno por combinación liga×posición).
- [contracts/player-api.md](./contracts/player-api.md): `GET /players` (filtros,
  paginación, forma de la respuesta) y `GET /players/:id` (200/404), más el contrato
  de `ApiKeyGuard` (header, 401 en sus 4 variantes).
- [quickstart.md](./quickstart.md): pasos reproducibles para correr la migration,
  levantar el backend y validar filtros/paginación/404/ApiKey manualmente y con la
  suite automatizada.

## Post-Design Constitution Re-Check

Sin cambios respecto del gate inicial: el diseño de Phase 1 mantiene las capas,
concentra la validación de enums en el dominio, agrega una única rama al filtro
global existente en vez de duplicar manejo de errores, y no introduce dependencias
fuera del stack ni variables de entorno nuevas. Sin desviaciones nuevas que registrar.
