# Contrato REST — Emisión de ApiKey

Base URL backend: `http://localhost:3000`. Formato: JSON. Todos los errores siguen el formato centralizado del `AllExceptionsFilter`.

---

## `POST /auth/api-key` — Emisión / Reemplazo de ApiKey

Genera una nueva ApiKey para el usuario autenticado. Requiere autenticación previa mediante JWT.
Si el usuario ya tenía una ApiKey activa, queda automáticamente invalidada y revocada.

* **Método**: `POST`
* **Ruta**: `/auth/api-key`
* **Autenticación**: Obligatoria. Header `Authorization: Bearer <jwt_token>`.
* **Exención `@Public()`**: **NO**. Protegido por `JwtAuthGuard`.

### Headers de Solicitud

| Header | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `Authorization` | string | Sí | Token JWT de sesión en formato `Bearer <token>` |
| `Content-Type` | string | Opcional | `application/json` (el endpoint no requiere body) |

### Request Body
No requiere cuerpo (body vacío o `{}`). Campos no declarados son ignorados o rechazados según la configuración global de `ValidationPipe`.

### Respuesta Exitosa: `201 Created`

Retorna la clave en texto plano únicamente en esta respuesta. No se expone ningún hash ni se conserva la clave en texto plano en el servidor.

```json
{
  "id": "7b8c2d1e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
  "apiKey": "pmk_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "createdAt": "2026-09-11T16:00:00.000Z"
}
```

#### Campos de la Respuesta (`IssueApiKeyResponseDto`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Identificador unívoco de la credencial ApiKey en la base de datos |
| `apiKey` | string | Valor en texto plano de la ApiKey (prefijo `pmk_` + 64 caracteres hex = 68 caracteres). **Única vez que se muestra**. |
| `createdAt` | string (ISO-8601) | Timestamp de emisión |

> [!WARNING]
> La propiedad `apiKey` en texto plano jamás podrá volver a ser consultada. Si el usuario la pierde, deberá invocar nuevamente este endpoint para emitir una nueva que invalidará la anterior.

---

### Errores Posibles

| HTTP Status | Caso | `statusCode` | `error` | `message` |
|-------------|------|--------------|---------|-----------|
| **401 Unauthorized** | Petición sin header `Authorization` | 401 | `Unauthorized` | `"No autenticado."` |
| **401 Unauthorized** | Token JWT malformado, con firma inválida o expirado | 401 | `Unauthorized` | `"No autenticado."` |
| **401 Unauthorized** | Usuario del token ya no existe en el sistema | 401 | `Unauthorized` | `"No autenticado."` |
| **500 Internal Server Error** | Error inesperado durante la transacción de persistencia | 500 | `Internal Server Error` | `"Error interno del servidor."` |

---

## Nota de Consumo Futuro: Header `X-Api-Key`

Para endpoints consumidores que acepten autenticación por ApiKey en lugar de JWT:
* La clave viajará en el encabezado `X-Api-Key`:
  ```http
  X-Api-Key: pmk_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  ```
* El header `Authorization` permanece reservado con exclusividad al esquema `Bearer <jwt>`.

