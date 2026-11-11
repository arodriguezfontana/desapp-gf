# Contract: Health API

`ApiTags('health')`. El endpoint es `@Public()` (exento del `JwtAuthGuard` global): **no requiere
JWT ni API key**. Es de sólo lectura y no modifica estado.

## `GET /health`

Informa si el backend está en condiciones de atender requests (spec FR-001..FR-005). Ejecuta un ping
a la base de datos con timeout de 3000 ms. No consulta Football-Data ni WhoScored (FR-006).

**Request**: sin parámetros, sin body, sin headers de autenticación.

**Response 200** — la base responde (`HealthResponseDto`):

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```

**Response 503** — la base no responde, rechaza la consulta o supera el timeout:

```json
{
  "status": "error",
  "info": {},
  "error": { "database": { "status": "down" } },
  "details": { "database": { "status": "down" } }
}
```

Variante por timeout (el único caso con `message`, de texto fijo):

```json
{
  "status": "error",
  "info": {},
  "error": { "database": { "status": "down", "message": "timeout of 3000ms exceeded" } },
  "details": { "database": { "status": "down", "message": "timeout of 3000ms exceeded" } }
}
```

**Notas de contrato**:
- El cuerpo del 503 **no** tiene el formato de error genérico de la API (`statusCode`, `error`, `message`, `timestamp`, `path`): es un informe de salud, y no pasa por `AllExceptionsFilter`.
- Los clientes que sólo miran el código de estado (`res.ok`) siguen funcionando; los campos `service` y `timestamp` del endpoint anterior **desaparecen**.
- Si en el futuro se habilitan shutdown hooks, durante el apagado puede devolverse `status: "shutting_down"` con 503.
- Sin información sensible: nunca se incluyen configuración, cadenas de conexión, credenciales, mensajes de error crudos ni stack traces (FR-008).
- Sin caché: cada llamada hace un chequeo nuevo (FR-010). Un `Cache-Control` no es necesario porque lo consumen herramientas, no navegadores.

**Errores**: ninguno distinto de los anteriores. Nunca `401`: el endpoint es público (FR-007). Un fallo inesperado fuera del ping (bug) lo resuelve `AllExceptionsFilter` como `500` genérico.

## Impacto en documentación (Principios VIII y X)

- **Swagger**: `@ApiOperation`, `@ApiResponse(200)` y `@ApiResponse(503)` con `HealthResponseDto` en `HealthController`.
- **Postman** (`docs/postman/desapp.postman_collection.json`, request «Root y Health — públicos, sin token»): aserciones de `status === "ok"` y `details.database.status === "up"`, y descripción que mencione el 503 (no reproducible desde la colección).
