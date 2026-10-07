# Research: Rol de usuario (admin / user) y rol copiado en la ApiKey

**Feature**: `008-admin-role-api-key` | **Date**: 2026-10-04

Cada decisión sigue el formato Decision / Rationale / Alternatives. Todas las preguntas de Technical Context quedaron resueltas: no hubo NEEDS CLARIFICATION.

---

## R1. Cómo llega la columna `role` a la base

**Decision**: la columna `role` se agrega con una migration formal en `backend/src/database/migrations/1790985600000-AddRoleToUsersAndApiKeys.ts`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'user';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'user';
```

`down()` elimina ambas columnas. Las entidades declaran la columna con el mismo tipo y default. Las filas existentes de `api_keys` (y de `users`) reciben `'user'` por el default, lo que cumple la spec (US4).

**Cómo corre**: el proyecto ya tiene un runner de migrations (`runPlayerCatalogMigrations`, `src/database/run-player-catalog-migrations.ts`) que usa un `DataSource` standalone sobre `src/database/migrations/*.{ts,js}` y lo invoca desde `main.ts` después de `NestFactory.create`. La migration nueva entra en ese mismo glob, así que corre en el deploy sin wiring nuevo. El seed del admin se ejecuta después de ese paso, por lo que la columna existe antes de insertar.

**Idempotencia**: en dev, `synchronize` ya creó la columna al construir la app; `ADD COLUMN IF NOT EXISTS` lo vuelve un no-op. En producción, `synchronize` está apagado y la migration es la que crea la columna.

**Rationale**: en producción `synchronize` está apagado con `NODE_ENV=production`; depender de él implicaría un paso manual que hay que recordar en cada deploy. La migration la corre el pipeline sin intervención.

**Alternatives considered**:
- Confiar en `synchronize` también en producción: se rechaza. Con `NODE_ENV=production` no crea nada, así que la app arrancaría y fallaría al leer `role`.
- Paso manual de `ALTER TABLE` en el deploy: se rechaza. Depende de que alguien lo acuerde en cada release.
- Agregar `migrations` / `migrationsRun` al `DataSource` de la app: se rechaza por consistencia con el research §2 de 004-player-catalog, que dejó `database.module.ts` intacto.

---

## R2. De dónde sale el rol al emitir la ApiKey

**Decision**: `ApiKeyController.issue` obtiene el `User` autenticado con `AuthService.getById(userId)` (Controller → Service, ya existente en `GET /auth/me`) y lo pasa a `ApiKeyService.issueApiKey(user: User)`. Dentro del mismo método que ya genera, revoca y guarda, se copia `user.role` en `ApiKey.issue(..., role)`.

**Rationale**: Respeta la constitución I: el controller no toca repositorios ni cruza módulos. Mantiene una sola operación de emisión (sin flujo paralelo, como pidió el alcance). El rol se lee una vez, en el momento de la emisión, que es lo que la spec exige.

**Alternatives considered**:
- Que `ApiKeyService` inyecte `USER_REPOSITORY` directamente: se rechaza. Obliga a exportar tokens de `AuthModule` a `ApiKeyModule` y hace que el service de ApiKey conozca la tabla de usuarios.
- Pasar `role` como string desde el controller: se rechaza. El controller no decide roles; el dato viene del dominio `User`.
- Cambiar la firma a `issueApiKey(userId, role)` con el controller resolviendo ambos: se rechaza por la misma razón que la primera opción; el service recibe el objeto de dominio, no datos sueltos que pueden desincronizarse.

---

## R3. Reutilizar la resolución de clave en `AdminApiKeyGuard`

**Decision**: Se extrae de `ApiKeyGuard.canActivate` un método protegido `resolveActiveApiKey(context): Promise<ApiKey>` que contiene la lógica actual (leer `x-api-key`, hashear, `findByHash`, `isActive`, lanzar 401). `canActivate` pasa a llamarlo y devuelve `true`. `AdminApiKeyGuard extends ApiKeyGuard`, llama a `resolveActiveApiKey` y verifica `apiKey.role === UserRole.ADMIN`; si no, lanza `ForbiddenException`.

**Rationale**: `ApiKeyGuard.canActivate` devuelve `true` y no expone la `ApiKey` resuelta; sin extraer algo, el guard nuevo no puede leer el rol sin repetir la búsqueda. La extracción es mecánica y no cambia ningún resultado observable: los tests existentes de `api-key.guard.spec.ts` deben pasar sin cambiar sus expectativas.

**Nota sobre el alcance**: el pedido dice "no modifiques el `ApiKeyGuard`" y, en la misma línea, permite "extraé su lógica de resolución de clave a un método reusable". Se eligió la segunda opción. El cambio toca el archivo pero no su comportamiento; la verificación es que su suite existente pase sin editar expectativas.

**Alternatives considered**:
- Extender sin tocar la clase base: no alcanza, por lo explicado arriba.
- Duplicar la búsqueda dentro de `AdminApiKeyGuard`: se rechaza. Dos caminos de resolución de ApiKey pueden divergir (por ejemplo, en el manejo de revocadas) y eso es un riesgo de seguridad.
- Subir la resolución a un `ApiKeyResolver` inyectable: válido, pero agrega una pieza más para un método de diez líneas. Se puede hacer si un tercer guard lo necesita.

**Código de error**: la constitución III lista 403 como código válido. Un ApiKey válida con rol `user` que llega a un endpoint admin recibe 403, no 401 (la clave sí está autenticada, solo le falta el rol).

---

## R4. Dónde vive el seed del primer admin

**Decision**: La lógica está en `AdminSeedService.run()` (capa Service, en `AuthModule`). `main.ts` lo invoca antes de `listen()`:

```ts
await app.get(AdminSeedService, { strict: false }).run();
```

**Rationale**: El seed necesita `UserRepository` y `PasswordHasher`. Ponerlo directamente en `main.ts` haría que la capa de wiring hable con repositorios y hashers, algo que la constitución I no permite fuera del Service. `main.ts` queda como arranque: no decide nada.

**Alternatives considered**:
- Seed en una migration SQL: se rechaza. El hash de `ADMIN_PASSWORD` tiene que hacerse con el mismo `PasswordHasher` (bcrypt) de la app.
- `OnApplicationBootstrap` del service: se rechaza para esta feature. Corre también en cada `Test.createTestingModule(...).init()` de las suites de test, lo que ensucia los tests de integración. Ejecutarlo desde `main.ts` deja el seed explícito y sin efectos en tests.

---

## R5. Arranques concurrentes sin lock nuevo

**Decision**: `run()` hace `existsByEmail`; si no existe, crea el `User` con rol `admin` y llama a `users.save`. `TypeOrmUserRepository.save` ya traduce el `23505` (unique violation del índice de `users.email`) a `EmailAlreadyInUseError`. El seed captura ese error y lo registra como "ya existe, sin cambios".

**Rationale**: La unicidad del email ya se garantiza en la base. Un lock de aplicación sería un mecanismo nuevo sin beneficio, y no protegería contra otra instancia que corra el mismo código.

**Orden de validaciones**: primero las variables presentes, luego el formato de `ADMIN_EMAIL` (`Email.create`), luego `existsByEmail`. Solo si el usuario no existe se valida `ADMIN_PASSWORD` (`Password.create`) y se hashea. Así una contraseña inválida en un arranque posterior no genera ruido si el admin ya existe, y el seed nunca hashea en vano.

**Alternatives considered**:
- `INSERT ... ON CONFLICT DO NOTHING`: válido, pero el repositorio actual no lo expone y `save` ya mapea el error. Se mantiene el patrón existente.
- Advisory lock de Postgres: se rechaza por complejidad sin beneficio frente al índice único.

---

## R6. Validación del rol: columna de texto + dominio

**Decision**: `UserRole` es un enum de TypeScript (`ADMIN = 'admin'`, `USER = 'user'`) en `domain/auth/user-role.ts`, con `parseUserRole(value)` que lanza `InvalidRoleError` si el valor no es uno de los dos. `User.register` y `ApiKey.issue/restore` llaman a `parseUserRole`. La columna es `varchar(16)`, no un enum nativo de Postgres.

**Rationale**: Es el criterio que el proyecto usa para `League` (`parseLeague`). Agregar un rol después no requiere `ALTER TYPE`.

**Alternatives considered**:
- Enum nativo de Postgres: se rechaza por el motivo de arriba y porque `synchronize` maneja los enums de forma frágil al cambiar valores.
- `CHECK (role IN ('admin','user'))` en la base: válido y barato. Queda como mejora opcional; no se incluye en el alcance para no introducir una restricción que `synchronize` no genera de forma declarativa con la misma sintaxis en todos los entornos. Con la validación en dominio, un valor inválido solo podría llegar por edición manual de la base, que la spec ya acepta como riesgo.

---

## R7. Exposición del rol en la API

**Decision**: `MeResponseDto` (`GET /auth/me`) agrega `role`. `RegisterResponseDto` no cambia. Ningún endpoint nuevo.

**Rationale**: El frontend y los tests de aceptación necesitan ver el rol del propio usuario. Es dato del propio usuario autenticado, no de otros. No se expone el rol de otros usuarios (la spec no tiene endpoint para eso).

**Alternatives considered**:
- No exponer el rol: se rechaza. Sin eso, la única forma de verificar el rol es mirar la base, lo que no sirve a los tests e2e.
- Agregar `role` también al registro: se rechaza para mantener el contrato del alta sin cambios; el rol siempre es `user` ahí y se puede verificar con `/auth/me`.

---

## R8. Impacto en tests existentes

**Decision**: Los fixtures que llaman a `ApiKey.issue(id, userId, hash, createdAt)` y `User.register(id, email, hash, createdAt)` en `api-key.spec.ts`, `api-key.guard.spec.ts`, `api-key.service.spec.ts`, `api-key.service.integration.spec.ts`, `user.spec.ts`, `jwt-auth.guard.spec.ts` y `auth.service.spec.ts` se actualizan para pasar el rol explícito (`UserRole.USER` por default). `User.register` conserva el default `USER` para que los callers que no hablan de rol no cambien. `ApiKey.issue` y `ApiKey.restore` exigen el rol (sin default) para que nadie emita una clave sin rol.

**Rationale**: Un default en `ApiKey.issue` ocultaría justo el caso que la feature quiere explícito (copia desde el emisor).

---

## Resumen de decisiones abiertas para el equipo

- **Despliegue (R1)**: ninguna acción manual. La migration corre con el deploy. Confirmar que el pipeline de deploy ejecuta el arranque de la app (y por tanto `runPlayerCatalogMigrations`), porque de eso depende que la migration corra.
- **Ninguna otra decisión queda abierta**: las tres que la spec dejó como supuestos (ADMIN_EMAIL existente no se promueve; sin variables no hay admin; sin operaciones admin en este alcance) siguen tal como están en la spec.
