# Quickstart — Validación de la feature de autenticación

Guía reproducible para levantar el entorno y verificar el flujo end-to-end. No contiene código de implementación; los detalles de contrato están en [contracts/](./contracts/) y el modelo en [data-model.md](./data-model.md).

## Prerrequisitos

- Node ≥ 18 y `pnpm` 9.
- Postgres accesible localmente con la base ya creada — existe de forma nativa en la máquina de desarrollo. La cadena de conexión (host, puerto, usuario, contraseña, base) vive **sólo** en `backend/.env` como `DATABASE_URL`; no se reproduce en esta documentación.
- `backend/.env` con `DATABASE_URL` (ya presente), `JWT_SECRET` (nuevo — ver abajo) y `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (nuevos, sólo si se usa el docker-compose; deben coincidir con lo que codifica `DATABASE_URL`).

## Setup

```bash
cd backend
pnpm install                      # trae @nestjs/config, @nestjs/typeorm, typeorm, pg, @nestjs/jwt, bcrypt, class-validator, class-transformer

# Agregar el secreto real de firma del JWT al .env (NO se versiona)
#   JWT_SECRET=<una cadena larga y aleatoria>
# El placeholder queda en .env.example. Confirmar que .env sigue en .gitignore:
git check-ignore backend/.env     # debe imprimir la ruta (está ignorado)
```

### Opción A — Postgres nativo (estado actual)

No hace falta nada extra: la base ya existe y `DATABASE_URL` (en `backend/.env`) apunta a ella. Con `NODE_ENV` distinto de `production`, TypeORM crea/actualiza la tabla `users` por `synchronize` al arrancar.

### Opción B — Postgres reproducible con docker-compose (nuevo)

```bash
# Requiere parar el Postgres nativo (conflicto en el puerto estándar de Postgres) o remapear POSTGRES_PORT.
# Antes: agregar POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB a backend/.env con los mismos
# valores que ya codifica DATABASE_URL. El compose los toma por interpolación; no lleva credenciales literales.
cd backend
docker compose up -d
```

## Arrancar el backend

```bash
cd backend
pnpm dev
# API en http://localhost:3000 — Swagger en http://localhost:3000/docs
```

Arranque correcto = sin errores de conexión de TypeORM y la tabla `users` visible en la base.

## Escenarios de validación

Reemplazar los valores de ejemplo según corresponda. Se puede usar `curl`, el Swagger UI, o la colección de Postman (`docs/postman/desapp.postman_collection.json`).

### 1. Alta exitosa (User Story 1 · FR-001, FR-006, FR-007)

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@mail.com","password":"Abcd1234!"}'
```

**Esperado**: `201 Created`; body con `id`, `email`, `createdAt`; **sin** `accessToken`. En la base, `password_hash` es un hash bcrypt (60 chars), nunca el texto plano.

### 2. Alta con email duplicado (FR-002 · SC-002)

Repetir el request anterior (mismo email, incluso con otra capitalización: `Ana@Mail.com`).

**Esperado**: `409 Conflict`, `message: "El email ya está registrado."`. La cuenta original no cambia.

### 3. Alta con contraseña que incumple la política (FR-003 · SC-003)

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@mail.com","password":"password"}'
```

**Esperado**: `400 Bad Request`, mensaje que enumera los requisitos. No se crea la cuenta. Probar también los bordes: 7 chars (falla) / 8 chars (ok), 16 (ok) / 17 (falla), `"Password 1"` (ok, el espacio cuenta como especial).

### 4. Login exitoso (User Story 2 · FR-010, FR-011)

```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@mail.com","password":"Abcd1234!"}'
```

**Esperado**: `200 OK`; body con `accessToken`, `tokenType: "Bearer"`, `expiresIn: 86400`. Decodificar el JWT (p. ej. en jwt.io) y verificar `exp - iat == 86400` y que el payload sólo trae `sub`, `iat`, `exp`.

### 5. Login fallido — indistinguible (FR-012 · SC-004)

```bash
# email inexistente
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"nadie@mail.com","password":"Abcd1234!"}'
# contraseña incorrecta
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@mail.com","password":"Wrong9$xy"}'
```

**Esperado**: ambas respuestas **idénticas** — `401`, mismo cuerpo (`message: "Credenciales inválidas."`). Los tiempos de respuesta deben ser del mismo orden (dummy bcrypt-compare).

### 6. Endpoint protegido con JWT válido (User Story 3 · FR-018)

Con un endpoint protegido de ejemplo (o, hasta que exista uno real, el e2e test usa un controller de prueba):

```bash
TOKEN=<accessToken del paso 4>
curl -i http://localhost:3000/<endpoint-protegido> -H "Authorization: Bearer $TOKEN"
```

**Esperado**: `200`, la operación se atribuye al usuario dueño del token.

### 7. Endpoint protegido — rechazos (FR-017 · SC-006)

```bash
curl -i http://localhost:3000/<endpoint-protegido>                                  # sin header  -> 401
curl -i http://localhost:3000/<endpoint-protegido> -H 'Authorization: Bearer xxx'   # malformado  -> 401
curl -i http://localhost:3000/<endpoint-protegido> -H 'Authorization: Bearer <jwt vencido>'  # vencido -> 401
```

**Esperado**: `401` en los tres casos, la operación no se ejecuta.

### 8. Alta y login siguen exentos (FR-016 · SC-009)

Los pasos 1 y 4 funcionan sin ningún header `Authorization`.

## Verificación automatizada

```bash
cd backend
pnpm test                 # unit (dominio, filtro) + integración (service/repo contra Postgres real)
pnpm test:e2e             # supertest: register -> login -> protegido (carpeta src/tests/auth/)
pnpm lint
pnpm build
```

En CI el job de backend levanta Postgres como servicio y corre integración + e2e (Principio IX).

## Checklist de "terminado" (Principio X)

- [ ] `pnpm test` y `pnpm test:e2e` en verde (casos felices y borde).
- [ ] `pnpm build` y `pnpm dev` levantan sin error con la config local.
- [ ] Swagger (`/docs`) muestra `POST /auth/register` y `POST /auth/login` con sus schemas y el candado Bearer en los endpoints protegidos.
- [ ] `docs/postman/desapp.postman_collection.json` actualizado con ambos requests (y variable de entorno para el token).
- [ ] `.env.example` tiene placeholders genéricos de `JWT_SECRET` y `POSTGRES_USER/PASSWORD/DB`; `.env` sigue git-ignored y es el único lugar con la conexión real.
- [ ] `docker-compose.yml` no contiene credenciales literales (sólo `${POSTGRES_*}`).
