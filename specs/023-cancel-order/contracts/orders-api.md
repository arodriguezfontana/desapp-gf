# API Contract: Cancelación y Consulta de Órdenes

Formato uniforme de error vía `AllExceptionsFilter` existente. Todos los endpoints requieren autenticación mediante JWT (`JwtAuthGuard`).

---

## 1. DELETE /orders/:id

Cancela una orden activa (`PENDING` o `PARTIALLY_FILLED`) perteneciente al usuario autenticado.

### Autenticación
* **Header**: `Authorization: Bearer <JWT>`
* Requiere sesión activa de usuario.

### Parámetros de Ruta
* `id` *(UUID, requerido)*: Identificador de la orden a cancelar.

### Respuestas

#### 200 OK
Devuelve la orden en su estado final cancelado (`status: "CANCELLED"`), manteniendo constancia de la cantidad remanente que fue retirada del mercado.

```json
{
  "id": "e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a",
  "side": "SELL",
  "playerId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "quantity": 10,
  "remainingQuantity": 4,
  "price": "25.00",
  "status": "CANCELLED",
  "createdAt": "2026-10-21T10:30:00.000Z",
  "fills": []
}
```

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
Petición sin token de autenticación o con token expirado/inválido.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 403 Forbidden
El usuario autenticado no es el propietario (`userId`) de la orden indicada.

```json
{
  "statusCode": 403,
  "message": "No tienes permisos para operar sobre esta orden.",
  "error": "Forbidden"
}
```

#### 404 Not Found
No existe ninguna orden con el `:id` especificado.

```json
{
  "statusCode": 404,
  "message": "La orden solicitada no existe.",
  "error": "Not Found"
}
```

#### 409 Conflict
La orden no puede cancelarse porque ya se encuentra en un estado terminal (`COMPLETED` o previamente `CANCELLED`).

```json
{
  "statusCode": 409,
  "message": "La orden no se puede cancelar porque ya fue completada o cancelada previamente.",
  "error": "Conflict"
}
```

---

## 2. GET /orders

Devuelve el listado de órdenes propias emitidas por el usuario autenticado, ordenadas cronológicamente en forma descendente (`createdAt DESC`).

### Autenticación
* **Header**: `Authorization: Bearer <JWT>`

### Respuestas

#### 200 OK
Array de órdenes del usuario (`OrderResponseDto[]`).

```json
[
  {
    "id": "e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a",
    "side": "SELL",
    "playerId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "quantity": 10,
    "remainingQuantity": 4,
    "price": "25.00",
    "status": "PARTIALLY_FILLED",
    "createdAt": "2026-10-21T10:30:00.000Z",
    "fills": []
  },
  {
    "id": "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e",
    "side": "BUY",
    "playerId": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "quantity": 5,
    "remainingQuantity": 0,
    "price": "18.50",
    "status": "COMPLETED",
    "createdAt": "2026-10-20T16:00:00.000Z",
    "fills": []
  }
]
```

#### 401 Unauthorized
Sin credenciales válidas.

