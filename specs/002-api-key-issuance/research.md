# Research & Architectural Decisions: Emisión de ApiKey

**Feature**: `002-api-key-issuance`
**Date**: 2026-09-11
**Status**: Completed

Este documento consolida las investigaciones técnicas y decisiones de diseño tomadas para la feature de Emisión de ApiKey, dando cumplimiento a los requerimientos del usuario y a la Constitución v1.5.0 del proyecto.

---

## 1. Algoritmo de Hashing: SHA-256 vs bcrypt

### Contexto
La Constitución (Principio IV) establece bcrypt para contraseñas de usuarios. Sin embargo, las ApiKeys son credenciales generadas por el sistema con alta entropía (256 bits pseudoaleatorios), a diferencia de las contraseñas elegidas por humanos que poseen baja entropía y son susceptibles a ataques de diccionario o fuerza bruta.

### Decisión
Utilizar **SHA-256** para el almacenamiento y verificación del hash de la ApiKey, abstrayendo el algoritmo detrás de una interfaz propia `TokenHasher` en la capa de puertos de dominio y un adaptador `Sha256TokenHasher` en la capa de adaptadores.

### Rationale
1. **Entropía criptográfica**: Con 32 bytes aleatorios (`2^256` combinaciones posibles), un ataque de fuerza bruta offline o precomputación con rainbow tables es matemáticamente inviable, eliminando la necesidad del costo de estiramiento de clave (*key stretching*) y salt lento de bcrypt.
2. **Impacto en latencia**: bcrypt impone deliberadamente un retardo de ~50–100 ms por verificación (adecuado para login de usuarios humanos). Usar bcrypt para ApiKeys penalizaría severamente la tasa de procesamiento (throughput) de cada petición API máquina a máquina (M2M) autenticada por ApiKey. SHA-256 se calcula en microsegundos en CPU.
3. **Resistencia a Timing Attacks**: La verificación de hashes en `TokenHasher.compare` se implementará utilizando `crypto.timingSafeEqual` sobre los buffers del hash esperado y el hash calculado, evitando ataques de canal lateral (*timing attacks*).

### Alternativas Evaluadas
* **bcrypt (descartada)**: Costo computacional excesivo e innecesario para secretos de 256 bits de entropía.
* **HMAC-SHA256 con clave secreta de servidor (descartada para v1)**: Agrega complejidad en la gestión de rotación de claves maestras sin aportar ventajas de seguridad críticas respecto a SHA-256 directo para tokens de 256 bits aleatorios.

---

## 2. Formato, Generación y Prefijo de la ApiKey

### Contexto
Se requiere generar una clave secreta que sea identificable visualmente y por herramientas de escaneo de secretos (Secret Scanning / SAST), sin reducir la entropía requerida.

### Decisión
La clave generada tendrá el formato:
```text
pmk_<64 caracteres hexadecimales>
```
* **Prefijo**: `pmk_` (Player Market Key), longitud fija de 4 caracteres.
* **Entropía**: 32 bytes aleatorios obtenidos mediante `crypto.randomBytes(32)`, convertidos a cadena hexadecimal (64 caracteres).
* **Longitud total**: 68 caracteres (`pmk_` + 64 hex = 68 caracteres).
* **Value Object de Dominio**: Se crea la clase `RawApiKey` en el dominio, que valida invariantes de formato (`/^pmk_[0-9a-f]{64}$/`), expone un factory method `RawApiKey.generate()` y el método `toPlainText(): string`.

### Rationale
* El uso de `crypto.randomBytes` garantiza que la fuente de entropía sea el CSPRNG del sistema operativo (Criptográficamente Seguro).
* El prefijo `pmk_` facilita la creación de expresiones regulares para scanners de seguridad (evitando que se suba accidentalmente a repositorios públicos) y permite al desarrollador identificar inmediatamente el propósito de la clave.
* La clase de dominio `RawApiKey` encapsula las reglas de generación y validación de formato antes de pasar por el hasher.

---

## 3. Modelo de Persistencia y Regla de 1 ApiKey Activa por Usuario

### Contexto
Cada usuario debe tener como máximo una ApiKey activa a la vez. Si solicita una nueva, la anterior queda invalidada de inmediato. No se requiere listar ni revocar explícitamente en esta fase.

### Decisión
Crear una tabla dedicada `api_keys` con soft-invalidation mediante la columna `revoked_at`:
* `id`: UUID (Clave primaria).
* `user_id`: UUID (Foreign key a `users(id)`, indexado).
* `key_hash`: `varchar(64)` (Hash SHA-256, índice único).
* `created_at`: `timestamptz` (Fecha de emisión).
* `revoked_at`: `timestamptz NULL` (Fecha de invalidación; `NULL` indica que la clave está activa).
* **Restricción de unicidad activa**: Índice parcial único en base de datos:
  ```sql
  CREATE UNIQUE INDEX idx_api_keys_active_user ON api_keys (user_id) WHERE revoked_at IS NULL;
  ```

### Rationale
1. **Auditoría e historial (Principio V / Rationale)**: Mantener las filas anteriores con `revoked_at` establecido en lugar de eliminarlas con `DELETE` físico deja registro de la existencia y fecha de rotación de las credenciales pasadas, sin comprometer la seguridad (el secreto nunca estuvo en la base).
2. **Garantía a nivel motor (ACID)**: El índice parcial `UNIQUE (user_id) WHERE revoked_at IS NULL` garantiza físicamente que bajo ninguna circunstancia de concurrencia o *race condition* puedan persistirse dos claves activas para un mismo usuario.
3. **Transaccionalidad (Principio VI)**: La operación de revocación de la clave anterior y creación de la nueva se ejecuta de forma atómica en el Service / Repository.

### Alternativas Evaluadas
* **Columna directa `api_key_hash` en la tabla `users` (descartada)**: Mezcla responsabilidades en `UserEntity` y viola el principio de cohesión y separación de agregados. Además, impediría auditar rotaciones pasadas.
* **Sobreescritura destructiva (`DELETE` / `UPDATE`) en `api_keys` (descartada)**: Pierde trazabilidad histórica de cuándo fue emitida y revocada la clave previa.

---

## 4. Transporte y Aislamiento de Headers

### Contexto
El usuario especificó: "La ApiKey viaja en el header `X-Api-Key` (no en `Authorization`, que queda reservado al JWT)".

### Decisión
1. Para el endpoint de emisión `POST /auth/api-key`, la autenticación se realiza mediante el estándar JWT ya existente en el header `Authorization: Bearer <token>`, protegido por `JwtAuthGuard`.
2. El header `X-Api-Key` queda formalmente reservado para la autenticación futura de endpoints que consuman la ApiKey. Esto garantiza total desacoplamiento y cero ambigüedad:
   * `Authorization`: reservado exclusivamente para credenciales JWT emitidas por login.
   * `X-Api-Key`: reservado exclusivamente para ApiKeys de integración.

---

## 5. Estructura Modular y Arquitectura en Capas (Principio I y IX)

### Decisión
Crear el módulo `ApiKeyModule` ubicado en `backend/src/modules/api-key/`, conectado a `AppModule`:
* **Controller**: `ApiKeyController` expone `POST /auth/api-key` (o `/api-keys`). Consume `CurrentUser()` inyectado por `JwtAuthGuard`. Devuelve `IssueApiKeyResponseDto` con la clave en texto plano y metadatos.
* **Service**: `ApiKeyService` orquesta la emisión. Recibe `userId`, genera `RawApiKey`, delega el hasheo a `TokenHasher` y la persistencia atómica a `ApiKeyRepository`.
* **Dominio**:
  * `ApiKey`: Entidad de dominio rica (`id`, `userId`, `keyHash`, `createdAt`, `revokedAt`, método `revoke()`, getter `isActive`).
  * `RawApiKey`: Value object con formato, generación y validación.
  * `TokenHasher`: Puerto de interfaz de dominio.
* **Repositorio**:
  * `ApiKeyRepository`: Puerto de dominio con métodos `findActiveByUserId(userId)`, `save(apiKey)`, etc.
  * `TypeOrmApiKeyRepository`: Implementación con TypeORM.
  * `ApiKeyEntity`: Entidad TypeORM mapped a `api_keys`.
  * `ApiKeyMapper`: Mapper explícito bidireccional dominio <-> entidad.
* **Adaptadores**:
  * `Sha256TokenHasher`: Implementación de `TokenHasher` con `node:crypto`.
* **Tests de Arquitectura (tsarch)**:
  * Se añadirán reglas en `layers.spec.ts` para verificar que `ApiKeyController` no dependa del repositorio ni del hasher, y que `ApiKeyService` no importe `node:crypto` ni entidades TypeORM directamente.

