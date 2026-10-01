# Contrato REST — Catálogo de Jugadores (diff sobre datos reales)

Este documento sólo cubre lo que **cambia** respecto del contrato ya vigente
de `004-player-catalog` (`specs/004-player-catalog/contracts/player-api.md`).
Todo lo no mencionado acá —query params de `GET /players`, paginación,
`ApiKeyGuard` y sus 4 casos de 401, formato de error único, 404 de
`GET /players/:id`— **no cambia** (spec FR-001, FR-002).

## Qué NO cambia

- Endpoints: `GET /players`, `GET /players/:id`.
- Autenticación: `ApiKeyGuard` (header `x-api-key`), sin aceptar JWT.
- Filtros: `league`, `team`, `position`, combinables con AND, mismas
  validaciones (400 fuera de enum).
- Paginación: `page`/`pageSize`, mismos defaults (`1`/`10`) y máximo (`50`).
- Comportamiento ante filtros sin resultados (200, lista vacía, `total: 0`) e
  id inexistente (404).

## Qué cambia: cuatro campos nuevos en la forma de un `Player`

Tanto un elemento de `items` en `GET /players` como la respuesta de
`GET /players/:id` agregan, después de `position`, cuatro campos nuevos —
**pueden ser `null`** (spec FR-006, FR-007, FR-018; Assumptions):

| Campo | Tipo | `null` cuando |
|-------|------|---------------|
| `passesCompleted` | `number \| null` | El jugador no tiene valor disponible para esta métrica (sin partidos en la temporada en curso, o falla técnica al obtener su página de estadísticas). |
| `shots` | `number \| null` | Ídem. |
| `interceptions` | `number \| null` | Ídem. |
| `rating` | `number \| null` | Ídem. |

Cuando tienen valor, cada uno es el promedio por partido jugado en la
temporada en curso (spec FR-007) — nunca un acumulado de temporada.

### Ejemplo — `GET /players/:id`, `200 OK`

```json
{
  "id": "b3f1c2a4-...",
  "name": "Erling Haaland",
  "league": "Premier League",
  "team": "Manchester City",
  "position": "FW",
  "passesCompleted": 8.4,
  "shots": 3.9,
  "interceptions": 0.2,
  "rating": 7.31
}
```

### Ejemplo — jugador sin valor disponible para sus métricas

```json
{
  "id": "c7a2e910-...",
  "name": "Jugador Recién Debutado",
  "league": "La Liga",
  "team": "Real Sociedad",
  "position": "MF",
  "passesCompleted": null,
  "shots": null,
  "interceptions": null,
  "rating": null
}
```

Un cliente que ya integraba contra el catálogo de `004` sigue funcionando sin
cambios: los cuatro campos son estrictamente aditivos al final del objeto.

## Origen de los datos: ya no hay carga manual

`GET /players` y `GET /players/:id` siempre leen de la última sincronización
exitosa de cada equipo (spec FR-009, FR-010) — nunca disparan scraping en
vivo, nunca esperan una corrida en curso. No hay ningún endpoint nuevo para
iniciar, consultar o forzar una sincronización: es exclusivamente un proceso
interno programado (`PlayerSyncService`, ver plan.md y
`contracts/whoscored-adapter.md`), fuera del alcance de este contrato REST.

## Swagger

`PlayerResponseDto` (y por lo tanto `PlayerListResponseDto.items[]`) agrega
los cuatro `@ApiProperty({ nullable: true, ... })` nuevos. No se agrega ningún
esquema de seguridad nuevo ni cambia `ApiKeyAuth`.
