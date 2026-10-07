# Contract: Player Catalog API

## Endpoints

### 1. `GET /players`

Retorna el catálogo paginado de jugadores con filtros opcionales.

**Headers**:
- `X-Api-Key: <api_key>` (Requerido)

**Query Parameters**:
- `league` (opcional): Nombre de la liga (ej. "La Liga", "Premier League")
- `team` (opcional): Nombre o fragmento del nombre del equipo
- `position` (opcional): Posición (GK, DF, MF, FW)
- `page` (opcional, default: 1): Número de página
- `pageSize` (opcional, default: 20): Tamaño de página

**Response 200 OK**:
```json
{
  "data": [
    {
      "id": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
      "name": "Bruno Fernandes",
      "league": "Premier League",
      "team": "Manchester United",
      "position": "MF",
      "passesCompleted": 55.6,
      "shots": 3.8,
      "interceptions": 0.4,
      "rating": 7.39,
      "crestUrl": "https://crests.football-data.org/66.png",
      "goals": 3,
      "assists": 1,
      "keyPasses": 13,
      "dribbles": 2,
      "totalTackles": 5,
      "yellowCards": 0,
      "redCards": 0
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

---

### 2. `GET /players/:id`

Retorna la ficha técnica detallada de un jugador específico.

**Headers**:
- `X-Api-Key: <api_key>` (Requerido)

**Path Parameters**:
- `id` (UUID): Identificador interno del jugador

**Response 200 OK**:
```json
{
  "id": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
  "name": "Bruno Fernandes",
  "league": "Premier League",
  "team": "Manchester United",
  "position": "MF",
  "passesCompleted": 55.6,
  "shots": 3.8,
  "interceptions": 0.4,
  "rating": 7.39,
  "crestUrl": "https://crests.football-data.org/66.png",
  "goals": 3,
  "assists": 1,
  "keyPasses": 13,
  "dribbles": 2,
  "totalTackles": 5,
  "yellowCards": 0,
  "redCards": 0
}
```

**Response 404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Jugador no encontrado.",
  "error": "Not Found"
}
```

