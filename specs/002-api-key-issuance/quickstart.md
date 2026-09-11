# Quickstart — Validación de Emisión de ApiKey

Guía práctica para ejecutar y verificar el flujo end-to-end de la feature `002-api-key-issuance`. No contiene código de implementación; contratos en [contracts/](./contracts/) y modelo en [data-model.md](./data-model.md).

---

## 1. Prerrequisitos

* Node.js ≥ 18 y `pnpm` 9.
* Docker Desktop en ejecución (requerido para base local y Testcontainers en tests de integración).
* Feature 1 (`001-user-auth`) disponible en el backend con `DATABASE_URL` y `JWT_SECRET` configurados en `backend/.env`.

---

## 2. Ejecución de Tests Automatizados

Desde la carpeta `backend/`:

```bash
cd backend

# 1. Tests Unitarios (Dominio RawApiKey, ApiKey, Sha256TokenHasher)
pnpm test:unit

# 2. Tests de Arquitectura (Verifica que ApiKeyController y ApiKeyService cumplan las capas)
pnpm test:unit test/architecture/layers.spec.ts

# 3. Tests de Integración (PostgreSQL efímero con Testcontainers)
pnpm test:integration

# 4. Tests End-to-End (Flujo completo Register -> Login -> Issue ApiKey con supertest)
pnpm test:e2e
```

---

## 3. Escenarios de Validación Manual (End-to-End con curl)

Con el backend iniciado (`pnpm dev` en `http://localhost:3000`):

### Paso 1: Registrar e Iniciar Sesión de Usuario

```bash
# 1.1 Registrar usuario de prueba
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"apikey.tester@mail.com","password":"ValidPass123!"}'

# 1.2 Iniciar sesión para obtener el JWT
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"apikey.tester@mail.com","password":"ValidPass123!"}')

# Extraer el JWT del JSON de respuesta (requiere jq o copiar a mano)
JWT_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
```

---

### Escenario 1: Emisión exitosa de la primera ApiKey (User Story 1 · P1)

```bash
curl -i -X POST http://localhost:3000/auth/api-key \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Resultado Esperado**:
* Código HTTP: `201 Created`
* Respuesta JSON:
  ```json
  {
    "id": "<uuid-de-la-clave>",
    "apiKey": "pmk_<64-caracteres-hexadecimales>",
    "createdAt": "2026-09-11T..."
  }
  ```
* **Verificación de Persistencia**:
  En la tabla `api_keys` de PostgreSQL:
  ```sql
  SELECT id, user_id, key_hash, created_at, revoked_at FROM api_keys;
  ```
  * `key_hash` contiene un hash SHA-256 de 64 caracteres.
  * El texto plano `pmk_...` **NO** existe en ninguna columna de la base.
  * `revoked_at` es `NULL` (la clave está activa).

---

### Escenario 2: Rotación e invalidación de la clave previa (User Story 2 · P1)

Volver a invocar el endpoint con el mismo JWT de usuario:

```bash
curl -i -X POST http://localhost:3000/auth/api-key \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Resultado Esperado**:
* Código HTTP: `201 Created`
* Respuesta JSON con un nuevo `id` y una nueva `apiKey` (`pmk_...`).
* **Verificación de Persistencia**:
  En la tabla `api_keys` de PostgreSQL:
  * La clave emitida en el Escenario 1 ahora tiene `revoked_at` no nulo con el timestamp de la segunda llamada.
  * La nueva clave tiene `revoked_at IS NULL`.
  * Hay exactamente una clave activa para el usuario.

---

### Escenario 3: Rechazo de petición no autenticada o con token inválido (User Story 3 · P2)

```bash
# 3.1 Sin header de autorización
curl -i -X POST http://localhost:3000/auth/api-key

# 3.2 Con token falso o malformado
curl -i -X POST http://localhost:3000/auth/api-key \
  -H "Authorization: Bearer token_falso_invalido"
```

**Resultado Esperado**:
* Código HTTP: `401 Unauthorized`
* Respuesta JSON uniforme:
  ```json
  {
    "statusCode": 401,
    "timestamp": "2026-09-11T...",
    "path": "/auth/api-key",
    "error": "Unauthorized",
    "message": "No autenticado."
  }
  ```
* En la base de datos no se registra ninguna clave nueva ni se altera la clave activa del usuario.

