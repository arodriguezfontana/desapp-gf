# Quickstart: Rol de usuario y rol copiado en la ApiKey

**Feature**: `008-admin-role-api-key` | **Date**: 2026-10-04

Guía para validar la feature de punta a punta en local. Asume Postgres corriendo y `backend/.env` con `DATABASE_URL` y `JWT_SECRET` (ver `backend/.env.example`).

## Prerrequisitos

- Backend instalado (`pnpm install` en `backend/`).
- `backend/.env` con, además de lo existente:
  - `ADMIN_EMAIL=<tu correo de admin de prueba>`
  - `ADMIN_PASSWORD=<contraseña que cumpla la política: 8–16, mayúscula, minúscula, dígito y especial>`
- `NODE_ENV` distinto de `production` (para que `synchronize` agregue la columna `role`).

## 1. Tests automáticos

```bash
cd backend
pnpm test:unit                 # dominio, servicios y guards con mocks
pnpm test:integration          # seed y ApiKeyService contra Postgres efímero
pnpm test:e2e                  # alta → rol user; emisión → rol copiado
```

Resultado esperado: todas las suites en verde. La suite de `api-key.guard.spec.ts` debe pasar **sin cambiar sus expectativas** (solo sus fixtures agregan el rol).

## 2. Seed del primer admin

1. Arrancar la app: `pnpm start:dev`.
2. En el log de arranque debe aparecer "admin creado" (primera vez).
3. Detener y volver a arrancar con las mismas variables.
4. Debe aparecer "admin ya existe, sin cambios". No debe haber un segundo usuario con ese correo.
5. Opcional: cambiar la contraseña del admin con `POST /auth/login` y un flujo manual, volver a arrancar, y verificar que el login con la contraseña nueva sigue funcionando (el seed no la resetea).

## 3. Rol en el alta y en `/auth/me`

1. `POST /auth/register` con un correo nuevo, incluyendo `"role": "admin"` en el body.
2. `POST /auth/login` con esa cuenta, obtener el JWT.
3. `GET /auth/me` con `Authorization: Bearer <jwt>`. Debe devolver `"role": "user"`.

## 4. Copia del rol en la ApiKey

1. Con el admin del seed: `POST /auth/login`, luego `POST /auth/api-key`. Guardar la ApiKey.
2. Con el usuario `user` del paso 3: `POST /auth/api-key`. Guardar la ApiKey.
3. Verificar en la base que cada fila de `api_keys` tiene su `role` correspondiente (`admin` para la del seed, `user` para la otra).

## 5. No retroactividad (riesgo aceptado)

1. Con el usuario del paso 4, emitir una ApiKey (rol `user` copiado).
2. Cambiar el rol de ese usuario directamente en la base a `admin` (única vía, por diseño).
3. La ApiKey emitida en el paso 1 conserva `role = 'user'` en `api_keys`.
4. Emitir una ApiKey nueva con ese mismo usuario: su `role` pasa a `admin`, y la anterior queda revocada.

## 6. Despliegue a producción

La columna `role` la crea la migration `1790985600000-AddRoleToUsersAndApiKeys`, que corre en el arranque del deploy a través de `runPlayerCatalogMigrations` (no hay paso manual de `ALTER`).

Verificación posterior al deploy:
1. En el log de arranque no hay errores de migration.
2. `SELECT column_name, column_default FROM information_schema.columns WHERE table_name IN ('users','api_keys') AND column_name = 'role';` devuelve dos filas con default `'user'::character varying`.
3. Definir `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el entorno de producción y arrancar: el log muestra "admin creado" la primera vez.

Rollback: `down()` de la migration elimina ambas columnas. Hacerlo solo si se revierte también el código que las lee.

## Criterio de aceptación de la guía

- Los pasos 2 a 5 se cumplen sin editar código.
- En ningún log aparece el valor de `ADMIN_PASSWORD` ni de ninguna ApiKey (SC-006).
