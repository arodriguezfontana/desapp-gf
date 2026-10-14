# Contract: Portfolio API (`GET /users/:id/portfolio`)

Este documento formaliza el contrato HTTP consumido por el frontend para la funcionalidad de portfolio personal.

---

## Endpoint: Consultar Portfolio de Usuario

Recupera el resumen y el detalle de posiciones de tokens de futbolistas pertenecientes al usuario especificado.

- **Método**: `GET`
- **Ruta**: `/users/:id/portfolio`
- **Autenticación**: Requerida (Bearer JWT).
- **Control de Acceso**: El usuario autenticado solo puede consultar su propio portfolio (`:id` coincide con el identificador del token JWT).

---

### Headers de Solicitud

| Header | Tipo | Requerido | Descripción |
|---|---|---|---|
| `Authorization` | `string` | Sí | Token JWT de sesión en formato `Bearer <token>`. |
| `Content-Type` | `string` | Sí | `application/json` |

---

### Respuestas

#### 200 OK — Portfolio con Posiciones Activas

```json
{
  "holdings": [
    {
      "playerId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "playerName": "Erling Haaland",
      "tokenQuantity": 15,
      "averageBuyPrice": 120.50,
      "currentPrice": 145.00,
      "totalProfitLoss": 367.50
    },
    {
      "playerId": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
      "playerName": "Kylian Mbappé",
      "tokenQuantity": 10,
      "averageBuyPrice": 150.00,
      "currentPrice": 135.00,
      "totalProfitLoss": -150.00
    }
  ],
  "summary": {
    "totalInvested": 3307.50,
    "totalCurrentValue": 3525.00,
    "netProfitLoss": 217.50
  }
}
```

#### 200 OK — Portfolio Vacío (Sin tenencias)

El usuario no posee tokens adquiridos en su cuenta. Retorna un arreglo vacío de `holdings` (sin código de error).

```json
{
  "holdings": [],
  "summary": {
    "totalInvested": 0.00,
    "totalCurrentValue": 0.00,
    "netProfitLoss": 0.00
  }
}
```

#### 401 Unauthorized — Token Ausente, Inválido o Vencido

```json
{
  "statusCode": 401,
  "message": "No autorizado."
}
```
*Comportamiento en Frontend*: El cliente HTTP (`httpClient`) descarta las credenciales y dispara el evento `unauthorized`, derivando automáticamente en la redirección hacia `/login`.

#### 403 Forbidden — Acceso a Portfolio Ajeno

```json
{
  "statusCode": 403,
  "message": "No tienes permiso para acceder al portfolio de otro usuario."
}
```

#### 500 Internal Server Error — Falla Inesperada del Servidor

```json
{
  "statusCode": 500,
  "message": "Error interno del servidor."
}
```
*Comportamiento en Frontend*: La interfaz muestra un mensaje de alerta genérico en color de error Tailwind con botón para reintentar la consulta.

