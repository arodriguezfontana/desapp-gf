# Tasks: Rol de usuario (admin / user) y rol copiado en la ApiKey

**Input**: Design documents from `specs/008-admin-role-api-key/`

**Prerequisites**: plan.md (requerido), spec.md (requerido para user stories), research.md, data-model.md, contracts/auth-api-delta.md, quickstart.md

**Tests**: Incluidos. La plantilla los marca como opcionales, pero la constitución (Principio IX) exige tests unitarios, de integración y e2e para estos componentes, y el plan los define explícitamente.

**Organization**: Tareas agrupadas por user story para implementación y prueba independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: User story a la que pertenece (US1–US4)
- Rutas exactas relativas a la raíz del repo

## Path Conventions

Backend-only: `backend/src/` y `backend/test/`. Los tests de integración viven junto al código (`*.integration.spec.ts`), como en el resto del proyecto. Los e2e viven en `backend/test/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dejar registrada una línea base verde antes de tocar código.

- [X] T001 Ejecutar `pnpm test:unit` y `pnpm test:integration` en `backend/` y registrar el resultado de base (esperado: verde). Si hay fallos previos, documentarlos antes de empezar; no se corrigen en esta feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelo de dominio y persistencia del rol. Bloquea todas las user stories.

**⚠️ CRITICAL**: Ninguna user story arranca hasta cerrar esta fase.

**Nota de build**: al terminar esta fase, `ApiKeyService.issueApiKey` no compila porque `ApiKey.issue` exige el rol. Su corrección es T024 (US3), que arranca de inmediato. Por eso las suites de `ApiKeyService` no se corren entre esta fase y T024.

- [X] T002 [P] Crear `backend/src/domain/auth/user-role.ts` con `enum UserRole { ADMIN = 'admin', USER = 'user' }` y la función `parseUserRole(value: string): UserRole` que lanza `InvalidRoleError` si el valor no es uno de los dos.
- [X] T003 [P] Crear `backend/src/domain/auth/errors/invalid-role.error.ts` con `InvalidRoleError`, siguiendo el patrón de `invalid-email.error.ts` y `invalid-league.error.ts`. Mensaje en español.
- [X] T004 [P] Crear `backend/src/domain/auth/user-role.spec.ts`: acepta `'admin'` y `'user'`; rechaza `'superadmin'`, `''`, `'Admin'` (mayúscula) y `undefined`.
- [X] T005 Modificar `backend/src/domain/auth/user.ts`: agregar `role: UserRole` al constructor privado y al accessor `get role()`. `User.register(id, email, passwordHash, createdAt, role = UserRole.USER)` valida con `parseUserRole`. Depende de T002, T003.
- [X] T006 Modificar `backend/src/domain/auth/user.spec.ts`: default `user` cuando no se pasa rol; acepta `admin` explícito; rechaza rol inválido con `InvalidRoleError`. Depende de T005.
- [X] T007 [P] Modificar `backend/src/domain/api-key/api-key.ts`: agregar `role: UserRole` al constructor privado y al accessor `get role()`. `ApiKey.issue(id, userId, keyHash, createdAt, role)` sin default; `ApiKey.restore(id, userId, keyHash, createdAt, revokedAt, role)`. Ambos validan con `parseUserRole`. Depende de T002, T003.
- [X] T008 Modificar `backend/src/domain/api-key/api-key.spec.ts`: actualizar fixtures de `issue` y `restore` para pasar rol; agregar casos de rol copiado (`admin` y `user`), y de rol inválido. Depende de T007.
- [X] T009 [P] Modificar `backend/src/repositories/auth/entities/user.entity.ts`: agregar `@Column({ type: 'varchar', length: 16, default: 'user' }) role!: string;`. Mismo tipo y default que la migration (T011).
- [X] T010 [P] Modificar `backend/src/repositories/api-key/entities/api-key.entity.ts`: agregar la misma columna `role` (`varchar(16)`, default `'user'`).
- [X] T011 [P] Crear `backend/src/database/migrations/1790985600000-AddRoleToUsersAndApiKeys.ts`. `up()`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'user'` y lo mismo para `api_keys`. `down()`: `DROP COLUMN` en ambas tablas. Sigue el patrón de `SeedPlayerCatalog` (`queryRunner.query` con SQL crudo, `name` explícito).
- [X] T012 [P] Modificar `backend/src/repositories/auth/mappers/user.mapper.ts`: mapear `role` en `toDomain` (pasar a `User.register`) y en `toEntity`.
- [X] T013 [P] Modificar `backend/src/repositories/api-key/mappers/api-key.mapper.ts`: mapear `role` en `toDomain` (pasar a `ApiKey.restore`) y en `toEntity`.
- [X] T014 [P] Actualizar fixtures de `ApiKey.issue(` en `backend/src/guards/api-key/api-key.guard.spec.ts` para pasar rol. Solo cambian fixtures; las expectativas no se tocan. Buscar con `grep` también `ApiKey.restore(` en el repo y actualizar cada llamada.

**Checkpoint**: Dominio y persistencia compilan y tienen rol. `api-key.spec.ts` y `user.spec.ts` pasan. Los suites de `ApiKeyService` quedan pendientes hasta T024.

---

## Phase 3: User Story 1 - Todo usuario nuevo nace con rol user (Priority: P1) 🎯 MVP

**Goal**: Cualquier alta pública crea una cuenta con rol `user`, y el campo `role` enviado en el body se ignora.

**Independent Test**: Registrar con `"role": "admin"` en el body; el login y `GET /auth/me` devuelven `"role": "user"`.

### Tests for User Story 1

- [X] T015 [P] [US1] Agregar caso en `backend/src/services/auth/auth.service.spec.ts`: `register()` devuelve un `User` con `role === UserRole.USER`. El servicio no recibe rol: el test confirma que el default de dominio se aplica.
- [X] T016 [US1] Crear `backend/test/role.e2e-spec.ts` con el caso: `POST /auth/register` con body que incluye `"role": "admin"` → 400 (validación global `forbidNonWhitelisted`; desvío de la versión original de esta tarea, ver FR-003); `POST /auth/login` → JWT; `GET /auth/me` → `role` es `"user"`. Este archivo acumula también los casos de US3 y US4.

### Implementation for User Story 1

- [X] T017 [P] [US1] Modificar `backend/src/controllers/auth/dto/me-response.dto.ts`: agregar `role` con `@ApiProperty({ enum: ['admin', 'user'], example: 'user' })`, al constructor y a `fromDomain`.
- [X] T018 [P] [US1] Verificar que `backend/src/controllers/auth/dto/register-request.dto.ts` no declara `role`. Si el pipe global de validación no descarta campos no declarados, agregar el caso correspondiente a T016. No agregar campo al DTO.

**Checkpoint**: US1 funciona de forma independiente: alta → `role: user` en `/auth/me`.

---

## Phase 4: User Story 2 - El primer admin se crea al arrancar, sin duplicarse ni resetearse (Priority: P1)

**Goal**: Al arrancar, con `ADMIN_EMAIL` y `ADMIN_PASSWORD` definidas, existe un usuario admin. Arranques repetidos no crean otro, no resetean la contraseña y no cambian el rol de un usuario existente.

**Independent Test**: Arrancar dos veces con las mismas variables; hay una sola cuenta, con la contraseña modificada manualmente intacta.

### Tests for User Story 2

- [X] T019 [P] [US2] Crear `backend/src/services/auth/admin-seed.service.spec.ts` (unit, con mocks de `UserRepository`, `PasswordHasher`, `ConfigService`). Casos: variables ausentes → no hace nada y loguea aviso; `ADMIN_EMAIL` inválido → aviso sin `save`; usuario existente → no `hash`, no `save`, no cambia rol; usuario inexistente → `hash` y `save` con `role === ADMIN`; `EmailAlreadyInUseError` en `save` → no lanza, loguea "ya existe"; `ADMIN_PASSWORD` que no cumple `Password` → aviso sin `save`; ningún log contiene el valor de `ADMIN_PASSWORD`.
- [X] T020 [P] [US2] Crear `backend/src/services/auth/admin-seed.service.integration.spec.ts` contra Postgres efímero (Testcontainers). Casos: `run()` dos veces → una sola fila con ese correo; contraseña cambiada manualmente no se resetea en el segundo `run()`; `run()` concurrente (`Promise.all` de tres) → una sola fila, sin excepción; `ADMIN_EMAIL` que existe con rol `user` → no se promueve.

### Implementation for User Story 2

- [X] T021 [US2] Crear `backend/src/services/auth/admin-seed.service.ts`: `@Injectable()` con `@Inject(USER_REPOSITORY)`, `@Inject(PASSWORD_HASHER)` y `ConfigService`. Método `run(): Promise<void>` con el orden: variables presentes → `Email.create` → `existsByEmail` (si existe, log "admin ya existe, sin cambios" y salir) → `Password.create` → `hasher.hash` → `User.register(..., UserRole.ADMIN)` → `users.save`, capturando `EmailAlreadyInUseError`. Usa `Logger` de Nest. Nunca loguea el valor de la contraseña. Depende de T005, T019.
- [X] T022 [US2] Modificar `backend/src/modules/auth/auth.module.ts`: agregar `AdminSeedService` a `providers`. Mismo archivo que T028 (US3), por eso no va en paralelo con ella.
- [X] T023 [US2] Modificar `backend/src/main.ts`: importar `AdminSeedService` y, después de `await runPlayerCatalogMigrations();` y antes de `app.listen`, agregar `await app.get(AdminSeedService, { strict: false }).run();`. El orden garantiza que la columna `role` exista antes del insert.

**Checkpoint**: US2 funciona de forma independiente: dos arranques con las mismas variables → una sola cuenta admin, contraseña intacta.

---

## Phase 5: User Story 3 - La ApiKey guarda el rol de quien la emitió (Priority: P1)

**Goal**: `POST /auth/api-key` copia el rol del usuario en el momento de la emisión. Los cambios posteriores de rol no tocan la clave ya emitida. `AdminApiKeyGuard` autoriza con el rol de la clave, sin consultar al usuario.

**Independent Test**: Emitir una clave con un usuario `user`; cambiar su rol por SQL; la clave previa sigue con `role = user`; una nueva emisión toma `admin`.

### Tests for User Story 3

- [X] T024 [P] [US3] Modificar `backend/src/services/api-key/api-key.service.spec.ts`: `issueApiKey(user)` con `user.role === ADMIN` → la clave tiene `role === ADMIN`; con `USER` → `USER`. Rotación con cambio de rol entre emisiones → la nueva clave toma el rol vigente. Los tests de rotación y revocación existentes siguen pasando.
- [X] T025 [P] [US3] Modificar `backend/src/services/api-key/api-key.service.integration.spec.ts` (Postgres efímero): la fila persistida tiene `role` correcto; cambiar el rol del `User` después de emitir no modifica la fila de la clave previa.
- [X] T026 [P] [US3] Crear `backend/src/guards/api-key/admin-api-key.guard.spec.ts` (unit, mocks de `TokenHasher` y `ApiKeyRepository`): sin header → 401; clave inexistente → 401; clave revocada → 401; clave activa con `role === USER` → `ForbiddenException` (403); clave activa con `role === ADMIN` → `true`. Verifica además que no se llama a ningún repositorio de usuarios.
- [X] T027 [US3] Agregar casos a `backend/test/role.e2e-spec.ts`: (a) un usuario `user` emite clave → la clave tiene rol `user`; (b) cambiar el rol del usuario por SQL a `admin` → la clave previa conserva `user` en `api_keys`; (c) volver a emitir → la nueva clave tiene `admin` y la anterior queda revocada. Depende de T016.

### Implementation for User Story 3

- [X] T028 [US3] Modificar `backend/src/services/api-key/api-key.service.ts`: `issueApiKey(user: User)` en lugar de `issueApiKey(userId: string)`. Dentro del mismo método existente, `ApiKey.issue(randomUUID(), user.id, keyHash, new Date(), user.role)`. El flujo de revocación y `saveWithRevocation` no cambia. Depende de T007.
- [X] T029 [US3] Modificar `backend/src/modules/auth/auth.module.ts`: agregar `AuthService` a `exports`. Va después de T022 (mismo archivo).
- [X] T030 [US3] Modificar `backend/src/modules/api-key/api-key.module.ts`: agregar `imports: [AuthModule]` para acceder a `AuthService`. Depende de T029.
- [X] T031 [US3] Modificar `backend/src/controllers/api-key/api-key.controller.ts`: inyectar `AuthService`. En `issue`, `const user = await this.auth.getById(userId);` y luego `this.apiKeys.issueApiKey(user)`. El controller no toca repositorios. Depende de T028, T030.
- [X] T032 [US3] Modificar `backend/src/guards/api-key/api-key.guard.ts`: extraer el método protegido `resolveActiveApiKey(context: ExecutionContext): Promise<ApiKey>` con la lógica actual (header, hash, `findByHash`, `isActive`, 401). `canActivate` lo llama y devuelve `true`. El comportamiento no cambia: `api-key.guard.spec.ts` debe pasar sin editar expectativas.
- [X] T033 [P] [US3] Agregar `FORBIDDEN_ROLE_MESSAGE` a `backend/src/shared/errors/messages.ts`, en español, sin revelar el rol requerido.
- [X] T034 [US3] Crear `backend/src/guards/api-key/admin-api-key.guard.ts`: `@Injectable()` que extiende `ApiKeyGuard`, con el mismo constructor. `canActivate` llama a `resolveActiveApiKey(context)` y, si `apiKey.role !== UserRole.ADMIN`, lanza `ForbiddenException(FORBIDDEN_ROLE_MESSAGE)`. No se aplica a ningún controller. Depende de T032, T033, T026.

**Checkpoint**: US3 funciona de forma independiente: la clave copia el rol al emitirse, no cambia retroactivamente, y el guard admin distingue por el rol de la clave.

---

## Phase 6: User Story 4 - ApiKeys anteriores al cambio quedan como user (Priority: P2)

**Goal**: Las claves y cuentas existentes antes de la migration reciben `role = 'user'` y siguen autenticando.

**Independent Test**: Insertar una fila de `api_keys` sin la columna `role`, correr la migration, verificar `role = 'user'` y que `findByHash` la devuelve activa con rol `user`.

### Tests for User Story 4

- [X] T035 [P] [US4] Crear `backend/src/database/add-role-migration.integration.spec.ts` (fuera de `migrations/`: el runner cargaría el spec como migration) contra Postgres efímero: crear tablas sin `role` con SQL crudo, insertar un usuario y una clave, correr `up()` de la migration, verificar que ambas filas tienen `role = 'user'`; correr `down()` y `up()` de nuevo (idempotencia por `IF NOT EXISTS`).
- [X] T036 [P] [US4] Crear `backend/src/repositories/api-key/typeorm-api-key.repository.integration.spec.ts` contra Postgres efímero: insertar una fila legacy (sin `role` explícito, con la columna en default `'user'`), y verificar que `findByHash` devuelve una `ApiKey` activa con `role === UserRole.USER`.

**Checkpoint**: US4 verificada: las claves previas siguen válidas y con rol `user`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, verificación y cierre de la definición de terminado (constitución X).

- [X] T037 [P] Actualizar el ejemplo de respuesta de `GET /auth/me` en `docs/postman/desapp.postman_collection.json` para incluir `role`.
- [X] T038 [P] Verificar en Swagger (`/docs`) que `MeResponseDto` muestra `role` con enum `admin | user`, y que `POST /auth/api-key` no cambió su contrato.
- [X] T039 Ejecutar `backend/test/architecture.spec.ts` y confirmar que las reglas de capas siguen pasando con `AdminSeedService`, `AdminApiKeyGuard` y el controller de ApiKey que ahora inyecta `AuthService`.
- [X] T040 Ejecutar `pnpm build` y `pnpm lint` en `backend/`; corregir solo lo introducido por esta feature.
- [X] T041 Ejecutar la suite completa: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`. Comparar contra la línea base de T001.
- [X] T042 Recorrer `specs/008-admin-role-api-key/quickstart.md` secciones 1 a 5 en local, sin editar código, y registrar el resultado. La sección 6 corresponde al deploy y no se ejecuta en local. — Parcial: los pasos 1–5 quedan cubiertos por las suites automáticas (ver T041) y el arranque manual de la app se verificó sin variables ADMIN_* (seed omitido con aviso, Swagger con role). El paso 2 con admin real (seed en base de desarrollo) no se ejecutó para no escribir en la base de dev.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. Bloquea todas las user stories.
- **User Stories (Phase 3–6)**: dependen de Foundational. US1 y US2 pueden avanzar en paralelo tras Phase 2. US3 depende de US1 solo por el e2e compartido (T016 → T027). US4 es independiente.
- **Polish (Phase 7)**: depende de todas las user stories.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Sin dependencias con otras stories.
- **US2 (P1)**: tras Foundational. Comparte `auth.module.ts` con US3: T022 antes que T029.
- **US3 (P1)**: tras Foundational. Usa `User.role` (US1 no lo necesita, pero el e2e de T027 extiende el archivo de T016).
- **US4 (P2)**: tras Foundational (la migration T011 es parte de Foundational). Independiente de US1–US3.

### Within Each User Story

- Tests antes de implementación cuando la tarea de test está marcada como tal.
- Dominio antes que servicio; servicio antes que controller; guard base (T032) antes que el guard admin (T034).

### Parallel Opportunities

- Foundational: T002, T003, T004, T007 (tras T002/T003), T009, T010, T011, T012, T013, T014.
- US1: T015 y T017 y T018 pueden correr en paralelo.
- US2: T019 y T020 en paralelo; después T021.
- US3: T024, T025, T026 y T033 en paralelo.
- US4: T035 y T036 en paralelo.
- Polish: T037 y T038 en paralelo.

**Conflictos de archivo a respetar**: `auth.module.ts` (T022 → T029), `role.e2e-spec.ts` (T016 → T027), `api-key.guard.ts` (T032 → T034).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002–T014). Dominio y persistencia listos.
3. Phase 3: US1 (T015–T018).
4. **STOP y validar**: alta con `role: admin` en el body devuelve `user` en `/auth/me`.

### Incremental Delivery

1. Setup + Foundational → modelo de rol en dominio y base.
2. US1 → alta siempre `user` (MVP).
3. US2 → primer admin por seed.
4. US3 → copia de rol en la ApiKey y guard admin.
5. US4 → verificación de claves legacy.
6. Polish → Swagger, Postman, arquitectura, build, quickstart.

---

## Notes

- Tareas de `[P]` = archivos distintos sin dependencias pendientes.
- Cada story es testeable por separado; el checkpoint de cada fase indica cuándo validar.
- El `ALTER` de producción no aparece como tarea: lo corre la migration T011 con el deploy (ver `research.md` R1).
- `.env.example` y la verificación de `.env` en `.gitignore` ya se hicieron en la fase de plan; no hay tarea.
- `AdminApiKeyGuard` no se aplica a ningún endpoint en esta feature (spec, Assumptions).
