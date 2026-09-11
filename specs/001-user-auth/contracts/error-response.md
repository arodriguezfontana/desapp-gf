# Contrato — Formato único de error (`AllExceptionsFilter`)

Principio III de la constitución: **un** exception filter global, formato de error JSON consistente, status code correcto, sin filtrar stack traces ni mensajes internos.

## Cuerpo uniforme

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "El email ya está registrado.",
  "timestamp": "2026-09-09T14:03:22.123Z",
  "path": "/auth/register"
}
```

| Campo | Descripción |
|-------|-------------|
| `statusCode` | igual al HTTP status de la respuesta |
| `error` | frase corta asociada al status (`Bad Request`, `Unauthorized`, `Conflict`, `Internal Server Error`) |
| `message` | string en español, o array de strings para errores de validación de `class-validator`. Nunca incluye stack, nombre de clase interna, SQL ni valores sensibles (contraseña, hash, JWT). |
| `timestamp` | ISO-8601, hora del servidor |
| `path` | path de la request |

## Mapeo origen → status

| Origen | `statusCode` | `error` | Notas |
|--------|--------------|---------|-------|
| `InvalidEmailError` (dominio) | 400 | `Bad Request` | |
| `InvalidPasswordError` (dominio) | 400 | `Bad Request` | mensaje enumera los requisitos de la política |
| `BadRequestException` de `ValidationPipe` | 400 | `Bad Request` | conserva el array `message` de class-validator |
| `InvalidCredentialsError` (dominio) | 401 | `Unauthorized` | `message: "Credenciales inválidas."` — idéntico para email inexistente y password incorrecta (FR-012) |
| `UnauthorizedException` (JwtAuthGuard) | 401 | `Unauthorized` | `message: "No autenticado."` |
| `EmailAlreadyInUseError` (dominio) | 409 | `Conflict` | |
| otra `HttpException` | su propio status | su propia frase | passthrough |
| cualquier `Error` no contemplado | 500 | `Internal Server Error` | `message: "Ocurrió un error inesperado."` — el `stack` va sólo al logger del servidor, nunca a la respuesta |

## Logging (Principio IV)

El filtro loguea `method`, `path`, `statusCode` y, para 5xx, `error.stack` — **en el logger del servidor**. Nunca loguea el body de la request (evita registrar contraseñas y JWT). Los DTOs de auth no se serializan a logs en ninguna capa.

## Registro

Una sola vez, en `AppModule`:

```ts
{ provide: APP_FILTER, useClass: AllExceptionsFilter }
```

No hay `@UseFilters` por controller ni filtros por módulo.
