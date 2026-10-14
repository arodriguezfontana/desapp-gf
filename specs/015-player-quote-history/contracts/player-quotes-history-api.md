# API Contract: GET /players/:id/quotes

## Endpoint

`GET /players/:id/quotes`

Devuelve el historial completo de cotizaciones calculadas para un jugador, ordenadas de la más antigua a la más reciente.

- **Seguridad**: `ApiKeyAuth` (header `x-api-key`). Exento de JWT (`@Public()`), igual que el resto de las rutas de `players` y `quotes`.
- **Parámetros de Ruta**:
  - `id` (string, UUID, obligatorio): Identificador del jugador.
- **Parámetros de Consulta (Query)**: Ninguno. Sin paginación ni filtro de rango de fechas (spec FR-006).

---

## Respuestas

### 200 OK — Historial obtenido (puede ser vacío)

**Headers**: `Content-Type: application/json`

**Cuerpo (JSON)** — jugador con historial:
```json
[
  {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "playerId": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
    "strategyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "score": 0.65,
    "value": 65.35,
    "calculatedAt": "2026-09-01T00:00:00.000Z",
    "appliedPosition": null
  },
  {
    "id": "a1b2c3d4-0000-0000-0000-000000000002",
    "playerId": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
    "strategyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "score": 0.712345,
    "value": 71.52,
    "calculatedAt": "2026-09-08T00:00:00.000Z",
    "appliedPosition": "FW"
  }
]
```
El array está ordenado ascendente por `calculatedAt` (spec FR-002). Cada elemento tiene la misma forma que el 200 de `GET /quotes/player/:playerId`.

**Cuerpo (JSON)** — jugador existente sin cotizaciones calculadas (spec FR-005):
```json
[]
```

---

### 401 Unauthorized — Sin autenticación o ApiKey inválida

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "API key inválida o ausente.",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/players/b3f1c2a4-1234-4a4a-8a8a-abcdef123456/quotes"
}
```

---

### 404 Not Found — Jugador inexistente (o dado de baja)

El `id` no corresponde a ningún jugador activo del catálogo (spec FR-004, Edge Cases).

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "No se encontró el jugador solicitado.",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/players/00000000-0000-0000-0000-000000000000/quotes"
}
```

---

## Diferencia con endpoints hermanos

| Endpoint | Devuelve |
|---|---|
| `GET /players/:id/quote` | Una sola cotización: la más reciente, o la vigente a una fecha (`?at=`) |
| `GET /quotes/player/:playerId` | Una sola cotización: la más reciente |
| **`GET /players/:id/quotes`** (esta feature) | **Todas** las cotizaciones del jugador, en orden ascendente |

No reemplaza a los otros dos: sirve para construir visualizaciones de evolución (el gráfico de líneas de la Historia 2 de spec.md), no para la consulta puntual del valor vigente.
