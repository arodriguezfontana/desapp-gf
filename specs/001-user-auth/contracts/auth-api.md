# Contrato REST — Autenticación

Base URL backend: `http://localhost:3000`. Formato: JSON. Todos los errores siguen [error-response.md](./error-response.md).

---

## `POST /auth/register` — Alta de cuenta

Público (`@Public()`). No requiere JWT. **No** inicia sesión ni devuelve token (FR-006).

### Request body

```json
{
  "email": "ana@mail.com",
  "password": "Abcd1234!"
}
```

| Campo | Regla de forma (DTO) | Regla de negocio |
|-------|----------------------|------------------|
| `email` | string, `@IsEmail`, requerido | `Email.create` normaliza (trim + lowercase) y valida formato |
| `password` | string no vacío, `@MaxLength(72)` | `Password.create`: 8–16 chars, ≥1 mayúscula, ≥1 minúscula, ≥1 dígito, ≥1 especial (no `[A-Za-z0-9]`) |

Campos no declarados en el body → **400** (`forbidNonWhitelisted`).

### Respuesta `201 Created`

```json
{
  "id": "3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b",
  "email": "ana@mail.com",
  "createdAt": "2026-09-09T14:03:22.000Z"
}
```

Sin `accessToken`, sin `password`, sin `passwordHash`.

### Errores

| Status | Caso | `message` |
|--------|------|-----------|
| 400 | forma inválida del body / email mal formado / password incumple política | detalle en español (array de class-validator, o mensaje del error de dominio) |
| 409 | el email normalizado ya está registrado (FR-002) | `"El email ya está registrado."` |

---

## `POST /auth/login` — Inicio de sesión

Público (`@Public()`). Endpoint independiente del alta (FR-009). No requiere JWT previo (FR-013).

### Request body

```json
{
  "email": "ana@mail.com",
  "password": "Abcd1234!"
}
```

| Campo | Regla de forma (DTO) |
|-------|----------------------|
| `email` | string, `@IsEmail`, requerido |
| `password` | string no vacío, requerido |

### Respuesta `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400
}
```

- `accessToken`: JWT firmado HS256. Payload: `{ "sub": "<userId>", "iat": <epoch>, "exp": <iat + 86400> }`. Sin email ni datos personales (FR-014).
- `expiresIn`: segundos hasta el vencimiento (24 h = 86400). Constante `JWT_EXPIRES_IN_SECONDS`.

### Errores

| Status | Caso | Cuerpo |
|--------|------|--------|
| 400 | falta `email` o `password`, o no son strings | error de forma de class-validator |
| 401 | email inexistente **o** contraseña incorrecta | **idéntico en ambos casos** (FR-012, SC-004): `{ "statusCode": 401, "error": "Unauthorized", "message": "Credenciales inválidas.", "timestamp": "...", "path": "/auth/login" }` |

El backend ejecuta un bcrypt-compare contra un hash dummy cuando el email no existe, para no delatar la existencia por latencia (research.md §6).

---

## Contrato de "endpoint protegido" (resto del sistema)

Todo endpoint que **no** esté marcado `@Public()` queda detrás de `JwtAuthGuard` (global). Aplica a las features futuras (comprar/vender tokens, portfolio). Exentos: `POST /auth/register`, `POST /auth/login`, `GET /`, `GET /health`.

### Requerimiento

```
Authorization: Bearer <accessToken>
```

### Comportamiento

| Situación | Resultado |
|-----------|-----------|
| Header ausente | **401**, operación no se ejecuta (FR-017) |
| Header presente sin esquema `Bearer` / vacío | **401** |
| JWT malformado / firma inválida / alterado | **401** (FR-017) |
| JWT vencido (> 24 h desde `iat`) | **401** (FR-017) |
| JWT válido y vigente, usuario existe | pasa; `request.user = { userId: <sub> }`, la operación se atribuye a ese usuario (FR-018) |
| JWT válido en forma pero el usuario ya no existe | **401** (FR-019) |

Cuerpo del 401: uniforme, `message: "No autenticado."` (o `"Credenciales inválidas."` para el caso de `/auth/login`). No se distingue entre "sin token", "inválido" y "vencido" en el cuerpo (no aporta al cliente legítimo y no ayuda a un atacante).

### Swagger

Los controllers protegidos llevan `@ApiBearerAuth()`. `main.ts` ya tiene `.addBearerAuth()` en el `DocumentBuilder`.
