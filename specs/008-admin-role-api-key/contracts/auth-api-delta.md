# Contrato delta: Rol de usuario

**Feature**: `008-admin-role-api-key` | **Date**: 2026-10-04

Solo se documenta lo que cambia respecto de `specs/001-user-auth/contracts/auth-api.md` y `specs/002-api-key-issuance`. Lo que no aparece acá queda igual.

## 1. `GET /auth/me` (cambio de respuesta)

Respuesta 200 pasa de `{ id, email }` a:

```json
{
  "id": "3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b",
  "email": "ana@mail.com",
  "role": "user"
}
```

| Campo | Tipo | Valores | Nota |
|-------|------|---------|------|
| `role` | string | `"admin"` \| `"user"` | Rol del usuario autenticado. Nunca es de otro usuario. |

Sin cambios en códigos de error (401 sin JWT / JWT inválido).

## 2. `POST /auth/register` (sin cambio de contrato)

- El body no acepta rol. Si el cliente envía `role`, la validación global de DTO (`whitelist` + `forbidNonWhitelisted`) responde **400** y no se crea la cuenta (FR-003). No se ignora en silencio: el campo es rechazado.
- Una cuenta creada por este endpoint siempre tiene rol `user`.
- Respuesta 201 sin cambios (`id`, `email`, `createdAt`).

## 3. `POST /auth/api-key` (sin cambio de contrato; cambio de efecto)

- Respuesta 201 sin cambios.
- Efecto: la ApiKey emitida queda con el rol del usuario en ese momento. El contrato HTTP no lo muestra; se verifica por `GET /auth/me` del emisor y por tests de integración (no hay endpoint para leer el rol de una ApiKey, consistente con FR-009 de 002).

## 4. Contrato de arranque: variables de entorno

| Variable | Obligatoria | Formato | Efecto |
|----------|-------------|---------|--------|
| `ADMIN_EMAIL` | No | email válido (`Email.create`) | Si falta o es inválido, el seed se omite y se loguea un aviso. |
| `ADMIN_PASSWORD` | No | cumple la política de `Password` (8–16, mayúscula, minúscula, dígito, especial) | Solo se usa si el usuario no existe. Si falta o no cumple la política, el seed se omite con aviso. |

Comportamiento del arranque:

| Estado previo | Resultado |
|---------------|-----------|
| No existe usuario con `ADMIN_EMAIL` | Crea usuario con rol `admin`. Log: "admin creado". |
| Ya existe usuario con `ADMIN_EMAIL` (cualquier rol) | No hace nada. Log: "admin ya existe, sin cambios". Contraseña y rol intactos. |
| Variables ausentes o inválidas | No hace nada. Log de aviso que nombra la variable, nunca su valor. La app arranca. |

Los logs NUNCA incluyen el valor de `ADMIN_PASSWORD` (FR-015, SC-006).
