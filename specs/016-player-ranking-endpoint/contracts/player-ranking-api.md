# API Contract: GET /players/ranking

## Endpoint

`GET /players/ranking`

Consulta el ranking de jugadores ordenados descendentemente por su cotización vigente (`valor`), utilizando el último quote calculado de cada futbolista. Excluye a jugadores sin cotizaciones.

- **Seguridad**: `ApiKeyAuth` (header `x-api-key`). Exento de JWT (`@Public()`).
- **Parámetros de Consulta (Query)**:
  - `league` (string, opcional): Filtrar por liga (`Premier League`, `Bundesliga`, `La Liga`, `Serie A`, `Ligue 1`).
  - `position` (string, opcional): Filtrar por posición (`GK`, `DF`, `MF`, `FW`).
  - `team` (string, opcional): Filtrar por coincidencia parcial en nombre de equipo.
  - `page` (integer, opcional, default: `1`, min: `1`): Número de página solicitada.
  - `pageSize` (integer, opcional, default: `10`, min: `1`, max: `50`): Elementos por página.

---

## Respuestas

### 200 OK — Ranking paginado obtenido

Retorna el conjunto de jugadores cotizados ordenados por `valor` desc, `score` desc, `id` asc. Si no hay coincidencias, devuelve lista vacía `items: []` con `total: 0`.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON) con resultados**:
```json
{
  "items": [
    {
      "rank": 1,
      "id": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
      "name": "Kylian Mbappé",
      "league": "La Liga",
      "team": "Real Madrid",
      "position": "FW",
      "crestUrl": "https://crests.football-data.org/86.png",
      "valor": 450.00,
      "score": 0.923450,
      "strategyName": "Estrategia Balanceada v1",
      "matchesPlayed": 18,
      "passesCompleted": 28.5,
      "shots": 4.1,
      "interceptions": 0.3,
      "rating": 8.24,
      "goals": 16,
      "assists": 5,
      "keyPasses": 24,
      "dribbles": 38,
      "totalTackles": 6,
      "yellowCards": 1,
      "redCards": 0
    },
    {
      "rank": 2,
      "id": "c4d2e3f5-5678-4b5b-9b9b-123456789abc",
      "name": "Vinicius Junior",
      "league": "La Liga",
      "team": "Real Madrid",
      "position": "FW",
      "crestUrl": "https://crests.football-data.org/86.png",
      "valor": 420.50,
      "score": 0.895100,
      "strategyName": "Estrategia Balanceada v1",
      "matchesPlayed": 17,
      "passesCompleted": 31.0,
      "shots": 3.8,
      "interceptions": 0.4,
      "rating": 8.15,
      "goals": 12,
      "assists": 8,
      "keyPasses": 30,
      "dribbles": 45,
      "totalTackles": 8,
      "yellowCards": 3,
      "redCards": 0
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 10
}
```

**Cuerpo (JSON) sin coincidencias**:
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 10
}
```

---

### 400 Bad Request — Parámetros de consulta inválidos

Ocurre cuando `page`, `pageSize`, `league` o `position` contienen valores no admitidos.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON)**:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "pageSize must not be greater than 50",
    "league must be one of the following values: Premier League, Bundesliga, La Liga, Serie A, Ligue 1"
  ],
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/players/ranking?pageSize=100&league=LigaInvalida"
}
```

---

### 401 Unauthorized — ApiKey ausente o inválida

No se incluyó la cabecera `x-api-key` o el valor proporcionado no es una clave activa válida.

**Headers**:
- `Content-Type: application/json`

**Cuerpo (JSON)**:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "API key inválida o ausente.",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/players/ranking"
}
```

