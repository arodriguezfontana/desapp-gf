# API Contract: GET /players/:id/quote

## Endpoint

`GET /players/:id/quote`

Consulta la cotización vigente de un jugador, opcionalmente a una fecha determinada.

- **Seguridad**: `ApiKeyAuth` (header `x-api-key`). Exento de JWT (`@Public()`).
- **Parámetros de Ruta**:
  - `id` (string, UUID, obligatorio): Identificador del jugador.
- **Parámetros de Consulta (Query)**:
  - `at` (string, opcional): Fecha en formato ISO 8601 (ej. `2026-09-15` o `2026-09-15T00:00:00Z`). Si está presente, retorna la cotización con `calculatedAt <=` final del día UTC solicitado (23:59:59.999Z). Si está ausente, retorna la cotización más reciente sin restricción de fecha.

---

## Respuestas

### 200 OK — Cotización encontrada

Retorna los datos de la cotización calculada vigente.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON)**:
```json
{
  "playerId": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
  "valor": 71.52,
  "score": 0.712345,
  "strategyName": "Performance General",
  "weights": {
    "goals": 0.35,
    "assists": 0.25,
    "rating": 0.20,
    "accuratePasses": 0.10,
    "keyPasses": 0.10,
    "dribbles": 0.05,
    "totalTackles": 0.05,
    "totalShots": 0.05,
    "interceptions": 0.05,
    "yellowCards": -0.05,
    "redCards": -0.10
  },
  "calculatedAt": "2026-09-15T18:30:00.000Z"
}
```

---

### 204 No Content — Sin cotización para esa fecha o historial

El jugador existe en el sistema, pero no posee ninguna cotización registrada (o ninguna calculada antes o durante la fecha indicada en `at`).

**Headers**:
- Sin `Content-Type`
**Cuerpo**:
- Vacío (0 bytes).

---

### 400 Bad Request — Fecha inválida

El parámetro `at` no tiene un formato parseable como fecha válida.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON)**:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "El parámetro \"at\" debe ser una fecha válida en formato ISO 8601.",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "path": "/players/b3f1c2a4-1234-4a4a-8a8a-abcdef123456/quote?at=invalido"
}
```

---

### 401 Unauthorized — Sin autenticación o ApiKey inválida

No se proveyó la cabecera `x-api-key` o el valor no es válido.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON)**:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "API key inválida o ausente.",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "path": "/players/b3f1c2a4-1234-4a4a-8a8a-abcdef123456/quote"
}
```

---

### 404 Not Found — Jugador inexistente

El `id` no corresponde a ningún jugador activo del catálogo.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON)**:
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "No se encontró el jugador solicitado.",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "path": "/players/00000000-0000-0000-0000-000000000000/quote"
}
```

