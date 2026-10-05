# Data Model: Rol de usuario y rol copiado en la ApiKey

**Feature**: `008-admin-role-api-key` | **Date**: 2026-10-04

## Enum de dominio: `UserRole`

Archivo: `backend/src/domain/auth/user-role.ts`

| Valor | String persistido | Significado |
|-------|-------------------|-------------|
| `ADMIN` | `'admin'` | Rol administrativo. Sin operaciones exclusivas en este alcance. |
| `USER` | `'user'` | Default. Todo alta público y toda ApiKey previa a la feature. |

`parseUserRole(value: string): UserRole` lanza `InvalidRoleError` si `value` no es uno de los dos.

## Entidad de dominio `User`

Archivo: `backend/src/domain/auth/user.ts`

| Campo | Tipo | Cambio | Regla |
|-------|------|--------|-------|
| `id` | string | sin cambio | — |
| `email` | `Email` | sin cambio | Único (índice en base) |
| `passwordHash` | string | sin cambio | Hash bcrypt |
| `createdAt` | Date | sin cambio | — |
| `role` | `UserRole` | **nuevo** | Siempre válido. `register` default `USER`. |

Factoría: `User.register(id, email, passwordHash, createdAt, role = UserRole.USER)`. `AuthService.register` no recibe ni pasa rol: el alta público siempre crea `user` (FR-003). Solo `AdminSeedService` llama con `UserRole.ADMIN`.

## Entidad de dominio `ApiKey`

Archivo: `backend/src/domain/api-key/api-key.ts`

| Campo | Tipo | Cambio | Regla |
|-------|------|--------|-------|
| `id`, `userId`, `keyHash`, `createdAt`, `revokedAt` | — | sin cambio | — |
| `role` | `UserRole` | **nuevo** | Rol copiado del emisor al momento de `issue`. Inmutable después. |

Factorías:
- `ApiKey.issue(id, userId, keyHash, createdAt, role)`: `role` es obligatorio (sin default).
- `ApiKey.restore(id, userId, keyHash, createdAt, revokedAt, role)`: usado solo por `ApiKeyMapper`.

Invariante: `role` no tiene setter. Un cambio de rol del `User` no se propaga a las `ApiKey` ya emitidas (FR-011, riesgo aceptado).

## Persistencia

### `users` (entidad `UserEntity`)

| Columna | Tipo | Nullable | Default | Nota |
|---------|------|----------|---------|------|
| `role` | `varchar(16)` | NOT NULL | `'user'` | **nueva**. Mapeada en `UserMapper`. |

### `api_keys` (entidad `ApiKeyEntity`)

| Columna | Tipo | Nullable | Default | Nota |
|---------|------|----------|---------|------|
| `role` | `varchar(16)` | NOT NULL | `'user'` | **nueva**. Filas previas quedan con `'user'` (US4, FR-013). |

Índices y restricciones existentes: sin cambio. `users.email` sigue siendo único (base del R5 de research.md). `api_keys` mantiene el índice parcial de una activa por usuario.

## Servicios y guards afectados

| Componente | Cambio | Entrada / salida |
|------------|--------|------------------|
| `AdminSeedService.run()` | **nuevo** | Lee `ADMIN_EMAIL`, `ADMIN_PASSWORD` de `ConfigService`. No devuelve nada. Efectos: crea o no hace nada; loguea el resultado. |
| `ApiKeyService.issueApiKey(user: User)` | firma cambia (antes recibía `userId`) | Copia `user.role` en `ApiKey.issue`. Mismo flujo de revocación y guardado. |
| `ApiKeyGuard.resolveActiveApiKey(context)` | **nuevo método protegido** (extraído) | Devuelve la `ApiKey` activa o lanza 401. `canActivate` lo usa y devuelve `true`. |
| `AdminApiKeyGuard` | **nuevo** | Extiende `ApiKeyGuard`. Tras resolver la clave, exige `role === ADMIN` o lanza 403. No aplicado a ningún endpoint. |

## Transiciones de estado

Rol de `User`: `user` ↔ `admin`. **No hay endpoint de transición.** La única creación de `admin` es el seed; cambios posteriores requieren acceso directo a la base (riesgo aceptado).

Rol de `ApiKey`: se fija en `issue` y no transiciona. Una rotación crea una `ApiKey` nueva con el rol vigente del `User`, y la anterior queda revocada (flujo existente de 002).
