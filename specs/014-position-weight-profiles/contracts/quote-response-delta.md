# API Contract Delta: indicador de perfil de posición en las respuestas de cotización

Esta feature no agrega endpoints nuevos. Extiende el cuerpo de respuesta de dos endpoints ya existentes (definidos en `specs/012-valuation-strategies/contracts/quotes-api.md` y `specs/013-player-quote-endpoint/contracts/player-quote-api.md`) con un campo nuevo: `appliedPosition`.

Sin cambios en seguridad, parámetros, códigos de estado ni en el resto del cuerpo de ninguno de los dos endpoints.

---

## `GET /quotes/player/:playerId`

**Campo nuevo en el 200 OK**:

```json
{
  "id": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
  "playerId": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
  "strategyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "score": 0.712345,
  "value": 71.52,
  "calculatedAt": "2026-10-08T03:00:00.000Z",
  "appliedPosition": "FW"
}
```

- `appliedPosition`: `"FW" | "MF" | "DF" | "GK" | null`.
  - Un valor de posición ⇒ la cotización se calculó con el perfil de esa posición.
  - `null` ⇒ la cotización se calculó con los pesos generales de la estrategia (no había perfil aplicable en el momento del cálculo).

Sin cambios en 401/404.

---

## `GET /players/:id/quote`

**Campo nuevo en el 200 OK**:

```json
{
  "playerId": "b3f1c2a4-1234-4a4a-8a8a-abcdef123456",
  "valor": 71.52,
  "score": 0.712345,
  "strategyName": "Performance General",
  "weights": {
    "goals": 0.45,
    "shots": 0.25,
    "assists": 0.15,
    "rating": 0.15
  },
  "calculatedAt": "2026-09-15T18:30:00.000Z",
  "appliedPosition": "FW"
}
```

- `weights` ahora refleja el perfil de posición cuando `appliedPosition` no es `null` (antes siempre eran los pesos generales de la estrategia); sigue siendo el snapshot histórico persistido en `PlayerQuote.weightSnapshot`, sin cambios de semántica.
- `appliedPosition`: misma semántica que en `GET /quotes/player/:playerId`.

Sin cambios en 204/400/401/404.

---

## Fuera de alcance

`GET /quotes/strategies` (listado de estrategias para el panel admin) **no se modifica**: `positionWeights` no se expone en `StrategyResponseDto` (ver research.md Decisión 6). Los perfiles de posición no tienen endpoint propio de lectura ni de escritura — se gestionan exclusivamente por seed (spec FR-008).
