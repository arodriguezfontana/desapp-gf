# Phase 1 — Data Model: Autenticación de usuarios

## Entidad de dominio: `User`

Clase de dominio rica. **Sin** decoradores de TypeORM, sin conocimiento de NestJS, HTTP ni base de datos (Principio I y II).

| Campo | Tipo (dominio) | Reglas | FR |
|-------|----------------|--------|----|
| `id` | `string` (UUID v4) | Generado al crear la cuenta. Inmutable. | FR-001, Key Entities |
| `email` | `Email` (value object) | Único a nivel sistema sobre el valor **normalizado**. | FR-002, FR-005, FR-008 |
| `passwordHash` | `string` | Hash bcrypt de la contraseña. Nunca la contraseña en claro. | FR-007 |
| `createdAt` | `Date` | Fijado al crear. Inmutable. | Key Entities |

**Comportamiento** (métodos de dominio):
- `User.register(id, email: Email, passwordHash: string, createdAt: Date): User` — factory; construye una cuenta ya validada. No hashea (el hash llega hecho desde el Adapter vía el Service) ni valida la política (eso ya lo garantizó `Password` antes de hashear).
- Getters de sólo lectura; la entidad no expone setters.

> El `User` no valida la política de contraseña porque en el momento en que se lo construye ya sólo se tiene el hash. La política se valida antes, sobre el texto plano, en el value object `Password` (ver abajo). El `User` sí depende de `Email` para garantizar que su email es siempre un valor normalizado y con formato válido.

---

## Value Object: `Email`

Encapsula normalización e invariante de formato (Principio II — la lógica no vive en el Controller ni el Service).

- **Factory**: `Email.create(raw: string): Email`
- **Normalización** (FR-005): `raw.trim().toLowerCase()`.
- **Invariante de formato** (FR-004): tras normalizar, debe matchear un patrón de email razonable (`algo@algo.dominio`, sin espacios). Si no, lanza `InvalidEmailError` de dominio → **400**.
  - *Nota*: el DTO ya aplica `@IsEmail` como primera barrera de forma; `Email.create` es la garantía de dominio y la que corre en los tests unitarios sin Nest.
- **Igualdad**: por valor normalizado. `equals(other: Email): boolean`.
- **Serialización**: `toString(): string` devuelve el valor normalizado (lo que se persiste y lo que se usa para buscar en login).

**Casos borde cubiertos por tests** (spec → Edge Cases):
- `"  Ana@Mail.com "` y `"ana@mail.com"` producen `Email` iguales.
- `"anamail.com"`, `"ana@"`, `"ana @mail.com"` → `InvalidEmailError`.

---

## Value Object: `Password`

Encapsula la política de contraseña (FR-003). Sólo existe transitoriamente durante el alta: valida el texto plano y no se persiste.

- **Factory**: `Password.create(plain: string): Password`
- **Reglas** (todas obligatorias; si alguna falla → `InvalidPasswordError` de dominio → **400**):

| Regla | Definición |
|-------|------------|
| Longitud | `plain.length` entre **8 y 16** inclusive |
| Mayúscula | al menos un carácter en `[A-Z]` |
| Minúscula | al menos un carácter en `[a-z]` |
| Dígito | al menos un carácter en `[0-9]` |
| Especial | al menos un carácter que **no** esté en `[A-Za-z0-9]` (incluye espacio interior, símbolos, puntuación, cualquier no-alfanumérico) |

- **Mensaje de error**: en español, indicando qué requisito falta (p. ej. `"La contraseña debe tener entre 8 y 16 caracteres, una mayúscula, una minúscula, un número y un carácter especial."`). No revela la contraseña.
- **Acceso al valor**: `value(): string` (sólo para pasárselo al `PasswordHasher`; nunca se loguea).

**Casos borde cubiertos por tests** (spec → Edge Cases):
- 7 y 17 caracteres → error; 8 y 16 → OK.
- `"Password1"` (sin especial) → error; `"Password 1"` (espacio como especial) → OK.
- Falta de dígito / mayúscula / minúscula → error, cada una por separado.

---

## Errores de dominio

| Clase | Se lanza cuando | Status vía `AllExceptionsFilter` | Mensaje (es) |
|-------|-----------------|----------------------------------|--------------|
| `InvalidEmailError` | `Email.create` recibe un valor con formato inválido | 400 | `"El email no tiene un formato válido."` |
| `InvalidPasswordError` | `Password.create` recibe un valor que incumple la política | 400 | ver arriba |
| `EmailAlreadyInUseError` | el Service detecta que el email normalizado ya existe (FR-002) | 409 | `"El email ya está registrado."` |
| `InvalidCredentialsError` | login con email inexistente **o** contraseña incorrecta (FR-012) | 401 | `"Credenciales inválidas."` |

Todos extienden una base `DomainError` (no un `HttpException`: el dominio no conoce HTTP — Principio I).

---

## Puerto de repositorio: `UserRepository`

Interface de dominio (token de inyección `USER_REPOSITORY`). Recibe y devuelve objetos de dominio (Principio I).

| Método | Firma | Uso |
|--------|-------|-----|
| `findByEmail` | `(email: Email) => Promise<User \| null>` | login (FR-010/FR-012); no se usa para el chequeo de unicidad del alta (ver `existsByEmail`) |
| `existsByEmail` | `(email: Email) => Promise<boolean>` | alta — chequeo previo de unicidad (FR-002) |
| `save` | `(user: User) => Promise<void>` | alta — persistir la cuenta nueva |
| `findById` | `(id: string) => Promise<User \| null>` | resolver `request.user` en operaciones protegidas / FR-019 |

**Garantía de unicidad concurrente (FR-008)**: además del `existsByEmail` previo, la tabla tiene un índice único sobre `email`; el `save` captura la violación de unicidad de Postgres y la traduce a `EmailAlreadyInUseError`. Así, si dos altas del mismo email pasan el `existsByEmail` a la vez, sólo una `save` gana y la otra recibe 409.

---

## Persistencia: tabla `users` (capa Repository únicamente)

Entidad TypeORM `UserEntity` (`@Entity('users')`). Vive sólo en `repository/entities/`; el Service nunca la ve. `UserMapper` convierte `UserEntity ↔ User` sin lógica de negocio.

| Columna | Tipo SQL | Constraints |
|---------|----------|-------------|
| `id` | `uuid` | PK, default generado |
| `email` | `varchar(320)` | `NOT NULL`, **`UNIQUE`** |
| `password_hash` | `varchar(60)` | `NOT NULL` (bcrypt produce 60 chars) |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |

- Índice único sobre `email` (respalda FR-008). El valor guardado ya viene normalizado desde el dominio, por lo que la unicidad case-insensitive se cumple sin `LOWER()` adicional.
- Sin columna de contraseña en claro, sin columnas de rol, sin `updated_at` (no hay updates en esta feature).
- Esquema creado por `synchronize` fuera de producción (ver research.md §2).

---

## Trazabilidad FR → modelo

| FR | Dónde se cumple |
|----|-----------------|
| FR-001 | `User.register` + `UserRepository.save` |
| FR-002 | `AuthService.register` (`existsByEmail`) + índice único + traducción en `save` |
| FR-003 | `Password.create` |
| FR-004 | `Email.create` (+ `@IsEmail` en DTO) |
| FR-005 | `Email.create` (normalización) |
| FR-006 | `RegisterResponseDto` sin token; `AuthService.register` devuelve sólo `User` |
| FR-007 | `passwordHash` es lo único que se persiste; `Password.value()` sólo va al hasher |
| FR-008 | índice único + `existsByEmail` + manejo de error de unicidad en el repo |
| FR-009..FR-014 | `AuthService.login` + `TokenIssuer` + `LoginResponseDto` |
| FR-015..FR-019 | `JwtAuthGuard` + `@Public()` + `UserRepository.findById` |
| FR-020 | `AllExceptionsFilter` (ver contracts/error-response.md) |
