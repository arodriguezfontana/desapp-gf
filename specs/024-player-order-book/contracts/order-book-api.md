# API Contract: Consulta del Libro de Órdenes

Endpoint para obtener la profundidad de mercado de tokens de un futbolista, agrupada por niveles de precio y separada en compras (`bids`) y ventas (`asks`).

---

## 1. GET /players/:id/order-book

### Autenticación
* **Header**: `Authorization: Bearer <JWT>`
* Requiere sesión activa de usuario (`JwtAuthGuard`).

### Parámetros de Ruta
* `id` *(UUID, requerido)*: Identificador único del futbolista cuyo libro de órdenes se desea consultar.

### Respuestas

#### 200 OK
Devuelve la instantánea de mercado del jugador con los niveles de compra y venta consolidados y ordenados canónicamente.

```json
{
  "playerId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "bids": [
    {
      "price": "24.50",
      "totalQuantity": 15
    },
    {
      "price": "23.00",
      "totalQuantity": 30
    }
  ],
  "asks": [
    {
      "price": "25.00",
      "totalQuantity": 10
    },
    {
      "price": "26.50",
      "totalQuantity": 25
    }
  ]
}
```

* **`bids`**: Niveles de demanda (`BUY`) ordenados de mayor a menor precio (`price DESC`).
* **`asks`**: Niveles de oferta (`SELL`) ordenados de menor a mayor precio (`price ASC`).
* Si no hay órdenes activas en alguno de los lados (o en ninguno), el campo correspondiente es un array vacío `[]`.

#### 400 Bad Request
El parámetro `:id` no es un identificador UUID válido.

```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

#### 401 Unauthorized
Solicitud enviada sin token de autenticación o con credenciales inválidas.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 404 Not Found
El jugador solicitado no existe en el catálogo.

```json
{
  "statusCode": 404,
  "message": "El jugador indicado no existe en el catálogo",
  "error": "Not Found"
}
```

