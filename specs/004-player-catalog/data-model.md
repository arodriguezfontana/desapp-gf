# Phase 1 — Data Model: Catálogo de Jugadores (datos de prueba)

## Enum de dominio: `League`

Sin decoradores de TypeORM, sin conocimiento de NestJS ni HTTP (Principio I). Valores
literales en inglés/nombre propio, tal como los pidió el usuario — son los mismos
strings que se persisten y los que se aceptan como valor del filtro `league`.

```
export enum League {
  PREMIER_LEAGUE = 'Premier League',
  BUNDESLIGA = 'Bundesliga',
  LA_LIGA = 'La Liga',
  SERIE_A = 'Serie A',
  LIGUE_1 = 'Ligue 1',
}
```

- **Factory de validación**: `parseLeague(value: string): League` — si `value` no es
  uno de los 5 valores de arriba, lanza `InvalidLeagueError` (dominio) → 400 vía la
  rama genérica del `AllExceptionsFilter` (research.md §4).

## Enum de dominio: `Position`

```
export enum Position {
  GK = 'GK',
  DF = 'DF',
  MF = 'MF',
  FW = 'FW',
}
```

- **Factory de validación**: `parsePosition(value: string): Position` — mismo
  comportamiento que `parseLeague` para valores fuera del enum → `InvalidPositionError`
  → 400.

## Entidad de dominio: `Player`

Clase de dominio simple (sin comportamiento de negocio más allá de exponer sus
campos: es un registro de referencia, no un agregado con invariantes propias más
allá de "liga y posición son válidas", que ya garantizan `League`/`Position` al
construirse).

| Campo | Tipo (dominio) | Reglas | FR |
|-------|----------------|--------|----|
| `id` | `string` (UUID) | Identificador técnico, fijo desde el seed. | FR-002, Key Entities |
| `name` | `string` | Nombre ficticio, no vacío. | FR-004, FR-005 |
| `league` | `League` | Uno de los 5 valores del enum. | FR-005, FR-006 |
| `team` | `string` | Nombre ficticio de equipo, no vacío. | FR-005, FR-006 |
| `position` | `Position` | Uno de los 4 valores del enum. | FR-005, FR-006 |

- **Factory**: `Player.restore(id, name, league, team, position): Player` — el
  catálogo es de sólo lectura vía API (FR-015): no existe un `Player.create()` de
  alta, sólo reconstrucción desde persistencia (mismo criterio que `ApiKey.restore`
  en `002`).
- Getters de sólo lectura, sin setters.

## Errores de dominio

| Clase | Se lanza cuando | Status vía `AllExceptionsFilter` | Mensaje (es) |
|-------|-----------------|-----------------------------------|--------------|
| `InvalidLeagueError` | `parseLeague` recibe un valor fuera de las 5 ligas | 400 (rama genérica `DomainError`, sin cambio en el filtro) | `"'<valor>' no es una liga válida."` |
| `InvalidPositionError` | `parsePosition` recibe un valor fuera de GK/DF/MF/FW | 400 (rama genérica) | `"'<valor>' no es una posición válida."` |
| `PlayerNotFoundError` | `PlayerService.getPlayerById` no encuentra el id pedido | **404 (rama nueva, agregada al filtro)** | `"No se encontró el jugador solicitado."` |

Los tres extienden `DomainError` (Principio I: el dominio no conoce HTTP).

## Puerto de repositorio: `PlayerRepository`

Interface de dominio (token de inyección `PLAYER_REPOSITORY`). Recibe y devuelve
objetos de dominio; el filtrado y la paginación se resuelven en Postgres (pedido
explícito del usuario), nunca cargando las 20 filas en memoria para filtrar ahí.

| Método | Firma | Uso |
|--------|-------|-----|
| `findPage` | `(filters: PlayerFilters, pagination: { page: number; pageSize: number }) => Promise<{ items: Player[]; total: number }>` | Listado (FR-006..FR-009); `WHERE` combina con AND sólo los filtros presentes, `LIMIT pageSize OFFSET (page-1)*pageSize`, `total` viene de un `COUNT` sobre el mismo `WHERE` sin paginar. |
| `findById` | `(id: string) => Promise<Player \| null>` | Detalle (FR-002, FR-010). |

```
export interface PlayerFilters {
  league?: League;
  team?: string;
  position?: Position;
}
```

- Orden de resultados: estable, `ORDER BY id ASC` (spec, Assumptions: "orden estable
  entre solicitudes").
- Filtro `team`: `WHERE LOWER(team) = LOWER($1)` — match exacto insensible a
  mayúsculas/minúsculas (spec, Assumptions).

## Persistencia: tabla `players` (capa Repository únicamente)

Entidad TypeORM `PlayerEntity` (`@Entity('players')`). Vive sólo en
`repositories/entities/`; el Service nunca la ve. `PlayerMapper` convierte
`PlayerEntity ↔ Player` sin lógica de negocio.

| Columna | Tipo SQL | Constraints |
|---------|----------|-------------|
| `id` | `uuid` | PK |
| `name` | `varchar(120)` | `NOT NULL` |
| `league` | `varchar(32)` | `NOT NULL` — valores válidos garantizados por el dominio, no por un `CHECK`/enum de Postgres (research.md §6) |
| `team` | `varchar(120)` | `NOT NULL` |
| `position` | `varchar(8)` | `NOT NULL` — mismo criterio que `league` |

- Esquema creado por `synchronize` (igual que `users`/`api_keys` hoy — sin cambios en
  `database.module.ts`).
- Filas insertadas **únicamente** por la migration de seed de esta feature
  (`SeedPlayerCatalog`), nunca por la API (FR-015: catálogo de sólo lectura).
- Sin índices adicionales: 20 filas fijas no lo ameritan (evita over-engineering).

## Seed: los 20 jugadores (una migration, `INSERT ... ON CONFLICT (id) DO NOTHING`)

Un club ficticio por liga, con sus 4 posiciones representadas — igual que un plantel
real, pero enteramente inventado (spec FR-004: ningún nombre de jugador real; los
clubes tampoco corresponden a clubes reales existentes).

| Liga | Equipo (ficticio) | Posición | Nombre (ficticio) |
|------|--------------------|----------|--------------------|
| Premier League | Northbridge FC | GK | Milo Ashworth |
| Premier League | Northbridge FC | DF | Callum Whitfield |
| Premier League | Northbridge FC | MF | Reece Dalton |
| Premier League | Northbridge FC | FW | Tobias Kane |
| Bundesliga | SV Falkenstein | GK | Jonas Reinhardt |
| Bundesliga | SV Falkenstein | DF | Lukas Brandt |
| Bundesliga | SV Falkenstein | MF | Finn Achterberg |
| Bundesliga | SV Falkenstein | FW | Matteo Vollmer |
| La Liga | CD Montebravo | GK | Iker Salazar |
| La Liga | CD Montebravo | DF | Adrián Fuentes |
| La Liga | CD Montebravo | MF | Nico Barreiro |
| La Liga | CD Montebravo | FW | Diego Marchena |
| Serie A | AC Ponteverde | GK | Luca Ferraresi |
| Serie A | AC Ponteverde | DF | Marco Sabbatini |
| Serie A | AC Ponteverde | MF | Simone Aldrovandi |
| Serie A | AC Ponteverde | FW | Enzo Ricciarelli |
| Ligue 1 | FC Beaumarais | GK | Hugo Lambert |
| Ligue 1 | FC Beaumarais | DF | Théo Marchand |
| Ligue 1 | FC Beaumarais | MF | Nathan Girard |
| Ligue 1 | FC Beaumarais | FW | Bastien Rocher |

Esta tabla es la fuente única de verdad para escribir la migration en la fase de
implementación: cada fila lleva además un UUID literal fijo (a generar una vez al
escribir la migration, no reproducido acá porque es un detalle de implementación sin
valor de diseño — ver research.md §6).

**Verificación de la invariante de la spec**: 5 ligas × 4 posiciones = 20
combinaciones, cada una con exactamente 1 fila — cualquier filtro combinado
liga+posición tiene al menos (exactamente) un resultado (spec FR-003, SC-001).

## Trazabilidad FR → modelo

| FR | Dónde se cumple |
|----|-----------------|
| FR-001, FR-002 | `PlayerController` (`GET /players`, `GET /players/:id`) + `PlayerService` |
| FR-003 | Seed de la migration (tabla de arriba, 20 filas) |
| FR-004 | Nombres/equipos ficticios de la tabla de seed |
| FR-005 | `Player` (dominio) + `PlayerEntity` (persistencia) |
| FR-006 | `PlayerRepository.findPage` con `PlayerFilters` combinados por AND |
| FR-007, FR-008 | `PlayerRepository.findPage` (`LIMIT/OFFSET` + `COUNT`) + `ListPlayersQueryDto` (defaults) |
| FR-009 | `findPage` devuelve `{ items: [], total: 0 }` sin lanzar error cuando no hay matches |
| FR-010 | `PlayerService.getPlayerById` + `PlayerNotFoundError` → 404 |
| FR-011, FR-012 | `ApiKeyGuard` (ver contracts/player-api.md) |
| FR-013 | `ListPlayersQueryDto` (`@IsInt`, `@Min`, `@Max`) |
| FR-014 | `parseLeague`/`parsePosition` en el Controller |
| FR-015 | `PlayerController` sólo expone `GET`; sin `POST`/`PUT`/`DELETE` |
