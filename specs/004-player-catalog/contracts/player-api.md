# Contrato REST — Catálogo de Jugadores

Base URL backend: `http://localhost:3000`. Formato: JSON. Los errores usan el mismo
formato único ya definido por `AllExceptionsFilter` (ver
`specs/001-user-auth/contracts/error-response.md`; sin cambios de forma, sólo se
agrega el status 404 para `PlayerNotFoundError`).

Ambos endpoints exigen `ApiKeyGuard` (ver abajo) y están marcados `@Public()`
respecto del `JwtAuthGuard` global: un JWT válido, presentado solo o junto con
cualquier otra cosa que no sea una ApiKey activa, **no** alcanza para autenticarse
acá.

---

## Autenticación: `ApiKeyGuard`

**Header requerido**: `x-api-key: <valor emitido por POST /auth/api-key>`.

| Situación | Resultado |
|-----------|-----------|
| Header `x-api-key` ausente | **401** |
| Header presente pero no corresponde a ninguna ApiKey emitida (inventado, adulterado, formato inválido) | **401** |
| Header corresponde a una ApiKey que existió pero fue reemplazada por una emisión posterior (revocada, `revokedAt IS NOT NULL`) | **401** |
| Se presenta un JWT válido (`Authorization: Bearer ...`) en lugar de `x-api-key`, con o sin `x-api-key` inválido | **401** |
| Header corresponde a una ApiKey activa (`revokedAt IS NULL`) | pasa |

Cuerpo del 401: uniforme, `message: "No autenticado."` — no se distingue en la
respuesta entre "ausente", "inválida" y "revocada" (mismo criterio que
`JwtAuthGuard` ya aplica: no aporta al cliente legítimo y no ayuda a un atacante).

### Swagger

`main.ts` agrega un esquema de seguridad `ApiKeyAuth` al `DocumentBuilder`
(`addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'ApiKeyAuth')`).
`PlayerController` lleva `@ApiSecurity('ApiKeyAuth')`.

---

## `GET /players` — Listado paginado y filtrable

### Query params

| Param | Tipo | Default | Validación | Nivel |
|-------|------|---------|------------|-------|
| `league` | string | — (sin filtrar) | debe ser una de las 5 ligas si se envía | Dominio (`parseLeague`) → 400 |
| `team` | string | — (sin filtrar) | ninguna a nivel forma; match exacto insensible a mayúsculas contra el catálogo | — |
| `position` | string | — (sin filtrar) | debe ser una de GK/DF/MF/FW si se envía | Dominio (`parsePosition`) → 400 |
| `page` | integer | `1` | entero ≥ 1 | DTO (`class-validator`) → 400 |
| `pageSize` | integer | `10` | entero, `1 ≤ pageSize ≤ 50` | DTO (`class-validator`) → 400 |

Los filtros presentes se combinan con AND. Campos de query no declarados →
**400** (`forbidNonWhitelisted`, ya global).

### Ejemplo de request

```
GET /players?league=La Liga&position=GK&page=1&pageSize=10
x-api-key: pmk_...
```

### Respuesta `200 OK`

```json
{
  "items": [
    {
      "id": "b3f1c2a4-...",
      "name": "Iker Salazar",
      "league": "La Liga",
      "team": "CD Montebravo",
      "position": "GK"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

- `total`: cantidad de jugadores que cumplen los filtros aplicados, **sin** paginar
  (no el tamaño de `items`).
- `items`: puede ser `[]` cuando ningún jugador cumple los filtros — sigue siendo
  **200**, nunca un error (FR-009, SC-006).
- Sin filtros, `page=1&pageSize=10` (defaults): `total=20`, `items` con los primeros
  10 jugadores por `id` ascendente.

### Errores

| Status | Caso |
|--------|------|
| 400 | `league`/`position` con un valor fuera de su enum |
| 400 | `page`/`pageSize` no numérico, `page < 1`, o `pageSize` fuera de `[1, 50]` |
| 401 | ver tabla de `ApiKeyGuard` arriba |

---

## `GET /players/:id` — Detalle de un jugador

### Ejemplo de request

```
GET /players/b3f1c2a4-...
x-api-key: pmk_...
```

### Respuesta `200 OK`

```json
{
  "id": "b3f1c2a4-...",
  "name": "Iker Salazar",
  "league": "La Liga",
  "team": "CD Montebravo",
  "position": "GK"
}
```

Misma forma que un elemento de `items` en el listado.

### Errores

| Status | Caso |
|--------|------|
| 404 | `id` con formato válido o inválido, pero que no corresponde a ningún jugador del catálogo (spec, Edge Cases: no se distingue un id malformado de uno bien formado pero inexistente) |
| 401 | ver tabla de `ApiKeyGuard` arriba |
