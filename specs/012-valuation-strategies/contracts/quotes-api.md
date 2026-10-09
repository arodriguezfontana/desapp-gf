# API Contract: Quotation Endpoints

## Autenticación

Todos los endpoints de esta feature son endpoints de operación de sistema. Se protegen con `AdminApiKeyGuard` (Principio IV de la constitución): requieren el header `x-api-key` con una API key válida con rol `ADMIN` registrada en la base de datos.

---

## POST /quotes/recalculate

Dispara el recálculo de cotizaciones para todos los jugadores activos usando la estrategia de valuación activa.

### Request

```
POST /quotes/recalculate
x-api-key: <admin-api-key>
```

Sin cuerpo.

### Response — 200 OK (recálculo completado)

```json
{
  "processedPlayers": 120,
  "errors": 0,
  "durationMs": 1842
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `processedPlayers` | `number` | Jugadores para los que se calculó y persistió una cotización |
| `errors` | `number` | Jugadores que fallaron durante el cálculo (sin detalle de error en producción) |
| `durationMs` | `number` | Duración total del recálculo en milisegundos |

### Response — 409 Conflict (recálculo en curso)

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Recalculation is already in progress"
}
```

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

### Response — 403 Forbidden (key válida pero sin rol ADMIN)

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Insufficient role"
}
```

### Response — 422 Unprocessable Entity (sin estrategia activa)

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "No active valuation strategy found"
}
```

**Nota**: Si no hay estrategia activa, el recálculo no puede ejecutarse. El error se lanza antes de adquirir el lock, por lo que no bloquea futuros intentos.

---

## Notas de diseño

- El endpoint no retorna las cotizaciones calculadas, solo el resumen de la operación. Para consultar cotizaciones de un jugador específico se necesitará un endpoint de lectura (fuera del alcance de esta feature).
- El lock de concurrencia es en memoria. En un entorno multi-instancia no previene recálculos paralelos entre instancias distintas. Limitación aceptada para el alcance académico del proyecto.
- El job semanal usa el mismo código que este endpoint pero no devuelve respuesta HTTP; simplemente retorna si el lock está tomado.
