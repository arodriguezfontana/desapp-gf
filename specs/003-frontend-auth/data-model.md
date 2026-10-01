# Data Model: Frontend — Autenticación

Esta feature es puramente de presentación y cliente; no define entidades de base de
datos nuevas. El modelo de datos relevante es el **estado en memoria del cliente** y los
**contratos de transferencia** con el backend.

---

## Entidades de dominio del cliente

### `AuthSession`

Representa la sesión activa del usuario en el frontend.

| Campo | Tipo | Origen | Notas |
|-------|------|--------|-------|
| `token` | `string \| null` | `localStorage['auth_token']` | JWT emitido por el backend. `null` = sin sesión. |
| `isAuthenticated` | `boolean` | derivado de `token !== null` | Único booleano expuesto por `AuthContext`. |

**Ciclo de vida**:
```
[sin sesión] → login exitoso → token guardado → isAuthenticated = true
                                                ↓
                               logout manual / 401 recibido → token borrado → isAuthenticated = false
```

**Persistencia en cliente**: `localStorage` con clave `auth_token`.
**Fuente de verdad**: `service/authStorage.ts` — los componentes nunca leen
`localStorage` directamente.

---

### `RawApiKey`

Representa la ApiKey en texto plano tal como la devuelve el backend.

| Campo | Tipo | Origen | Notas |
|-------|------|--------|-------|
| `id` | `string` (UUID) | respuesta del backend | Identificador de la ApiKey. |
| `apiKey` | `string` | respuesta del backend | Texto plano con prefijo `pmk_`. |
| `createdAt` | `string` (ISO-8601) | respuesta del backend | Timestamp de creación. |

**Ciclo de vida en cliente**:
```
[invoca POST /auth/api-key] → backend responde { id, apiKey, createdAt }
→ se guarda en estado local del componente modal (useState)
→ usuario cierra modal / navega → estado destruido → la clave ya no es accesible
```

**NO se persiste** en `localStorage`, `sessionStorage`, ni en ningún estado que
sobreviva a la navegación o recarga.

---

## Contratos de transferencia (DTOs)

### `RegisterRequestDto`

```ts
interface RegisterRequestDto {
  email: string;
  password: string;
}
```

### `LoginRequestDto`

```ts
interface LoginRequestDto {
  email: string;
  password: string;
}
```

### `LoginResponseDto`

```ts
interface LoginResponseDto {
  accessToken: string;  // JWT
  tokenType: 'Bearer';
  expiresIn: number;    // segundos (86400)
}
```

### `IssueApiKeyResponseDto`

```ts
interface IssueApiKeyResponseDto {
  id: string;
  apiKey: string;        // texto plano, prefijo pmk_
  createdAt: string;     // ISO-8601
}
```

### `ApiErrorDto`

Estructura de error que devuelve el backend para 400, 401, 409, etc.

```ts
interface ApiErrorDto {
  statusCode: number;
  message: string;       // se muestra directamente al usuario (excepto en login)
  error?: string;
  timestamp: string;
  path: string;
}
```

---

## Estado de pantalla (UI State)

### `FormState<T>`

Reutilizado en los formularios de registro y login.

```ts
interface FormState {
  isLoading: boolean;
  error: string | null;
}
```

### `ApiKeyPanelState`

Estado del panel de generación de ApiKey en `/account`.

```ts
type ApiKeyPanelState =
  | { phase: 'idle' }
  | { phase: 'confirming' }           // modal de confirmación visible (tenía una clave activa)
  | { phase: 'generating' }           // petición en curso
  | { phase: 'revealed'; key: RawApiKey }  // clave mostrada en modal
  | { phase: 'error'; message: string }
```

**Transiciones**:
```
idle → [pulsa "Generar"] → {sin clave previa} → generating → revealed
                         → {con clave previa} → confirming → [cancela] → idle
                                                           → [confirma] → generating → revealed
generating → [error] → error → [reintenta] → generating
revealed → [cierra modal] → idle
```

---

## Módulos de `service/` (no entidades, pero parte del modelo de datos del cliente)

### `authStorage.ts`

Capa de abstracción sobre `localStorage`. No tiene estado propio.

| Función | Firma | Descripción |
|---------|-------|-------------|
| `getToken` | `() → string \| null` | Lee `auth_token` de localStorage. |
| `setToken` | `(token: string) → void` | Guarda el JWT en localStorage. |
| `clearToken` | `() → void` | Elimina `auth_token` de localStorage. |

Constante interna: `AUTH_TOKEN_KEY = 'auth_token'`.

### `httpClient.ts`

Cliente HTTP centralizado. Expone:

| Export | Tipo | Descripción |
|--------|------|-------------|
| `httpClient` | objeto con `get`, `post` | Wrapper sobre `fetch` nativo (no axios — ver R-007). Lee la URL base de `import.meta.env.VITE_API_BASE_URL`. |
| `httpEvents` | `EventTarget` | Singleton. Emite `'unauthorized'` ante un 401. |

**Nota**: el proyecto ya tiene axios como dependencia (`package.json`) y un cliente en
`src/api/axios.ts`. La nueva arquitectura reemplaza ese cliente por `service/httpClient.ts`
usando `fetch` nativo para evitar la dependencia de axios en las capas que no corresponde
(ver R-007 sobre las restricciones de ESLint). El archivo `src/api/axios.ts` se elimina
en la limpieza de estructura.

### `authService.ts`

Operaciones de autenticación. No tiene estado.

| Función | Firma | Descripción |
|---------|-------|-------------|
| `register` | `(email, password) → Promise<void>` | POST /auth/register. Lanza `ApiError` si el backend responde con error. |
| `login` | `(email, password) → Promise<LoginResponseDto>` | POST /auth/login. |
| `generateApiKey` | `() → Promise<IssueApiKeyResponseDto>` | POST /auth/api-key. Requiere token en header. |

