# Research & Technical Decisions: Caché Redis y Degradación Controlada

**Feature**: `031-redis-cache-fallback` | **Date**: 2026-11-17

Este documento consolida la investigación técnica y las decisiones de diseño arquitectural para implementar la capa de caché distribuida en Redis, la política de degradación controlada ante fallos externos y los índices de base de datos sobre accesos reales, dando cumplimiento estricto a los Principios I y XIII de la constitución.

---

## 1. Selección del cliente de Redis: `ioredis`

### Contexto
NestJS ofrece soporte oficial para `@nestjs/cache-manager` (sobre `cache-manager` y `@keyv/redis`), o el uso directo de un cliente nativo como `ioredis` o `redis` (node-redis).

### Evaluación de alternativas
1. **`@nestjs/cache-manager` con v5/v6**:
   - *Pros*: Abstracción de alto nivel e integración nativa con decoradores de NestJS.
   - *Contras*: Suprime el control fino sobre eventos de desconexión (`error`, `close`, `reconnecting`), dificulta implementar una política *fail-open* estricta y transparente ante caídas del broker, y agrega capas de indirección innecesarias para invalidaciones masivas por prefijo (`SCAN` / `DEL`).
2. **`ioredis`**:
   - *Pros*: Cliente maduro, de alto rendimiento, estándar de la industria en Node.js / TypeScript. Soporta manejo explícito de reintentos (`retryStrategy`), listeners de eventos de conexión, comandos `pipeline` y eliminación por prefijo (`scanStream`). Permite atrapar cualquier error de socket o timeout sin que NestJS lance un 500 hacia el cliente.
   - *Contras*: Requiere instanciar un proveedor de servicio propio en NestJS (lo cual es muy simple y desacoplado).

### Decisión
Se adopta **`ioredis`** (v5.x) encapsulado dentro de un módulo de infraestructura propio `RedisCacheModule` y el servicio `RedisCacheService`. La configuración se inyecta desde `ConfigService`. Se desactiva el bloqueo de la aplicación configurando `lazyConnect: true` y `maxRetriesPerRequest: 1` para no encolar peticiones ante caídas de Redis.

---

## 2. Patrón de Caché y Ubicación Arquitectural: Cache-Aside en capa de Servicios

### Contexto
El Principio I de la constitución establece un sentido único de dependencias: `Controller → Service → {Dominio, Repository, Adapter}`. Los Controllers no deben contener lógica de negocio ni orquestación compleja.

### Evaluación
1. **Interceptors a nivel Controller**:
   - *Pros*: Intercepta la petición HTTP antes de ejecutar el handler del controller.
   - *Contras*: Enriquecimientos como los escudos de clubes (`PlayerEnrichmentService.loadCrests`) se ejecutan dentro del Service. Si se cachea solo en el controller, cualquier llamada interna a los servicios (p. ej. en scripts de simulación o endpoints futuros) elude la caché. Además, para endpoints autenticados como `GET /players/ranking`, el interceptor debe extraer el `userId` inyectado por el guard de JWT.
2. **Servicio dedicado o Interceptor híbrido con Cache-Aside en Servicios**:
   - La resolución de catálogo y detalle vive en `PlayerEnrichmentService`, y el ranking vive en `PlayerEnrichmentService` / `PlayerService`.
   - Colocar la verificación de caché en los métodos de servicio (`PlayerEnrichmentService` y `PlayerService`) o mediante un `HttpCacheInterceptor` respetando el contrato de respuesta garantiza que la respuesta enriquecida (jugadores + URLs de escudos + metadatos de ranking) se serialice completa en Redis.

### Decisión
Se implementa el patrón **Cache-Aside** en la capa de servicios (`PlayerEnrichmentService` para catálogo, detalle y ranking; y `HttpFootballDataAdapter` para respuestas externas). El servicio consulta primero a `RedisCacheService.get(key)`. Si existe (*hit*), deserializa y retorna. Si no existe (*miss*), ejecuta la consulta en la base de datos o API externa, guarda con `RedisCacheService.set(key, value, ttl)` y retorna.

---

## 3. Generación determinista y canónica de claves de caché

### Contexto
Los parámetros de consulta HTTP en `GET /players` y `GET /players/ranking` pueden enviarse en cualquier orden en la query string (por ejemplo `?league=Premier League&position=FW` vs `?position=FW&league=Premier League`), con espacios adicionales o mayúsculas. Una comparación literal de strings generaría claves distintas para la misma consulta semántica, degradando el *cache hit ratio*.

### Decisión
Se define una función utilitaria pura de dominio `buildCacheKey(namespace: string, params: Record<string, any>)`:
1. Filtra propiedades con valores `undefined` o vacíos.
2. Normaliza cadenas (trim y formato canónico).
3. Ordena las claves del objeto alfabéticamente (`sort()`).
4. Genera un hash SHA-256 de la cadena serializada y extrae los primeros 16 caracteres hexadecimales.
5. Construye la clave con el formato: `futval:<namespace>:<hash>` (o `futval:ranking:<userId>:<hash>` para rankings).

---

## 4. Estrategia de Invalidación: Reactiva orientada a eventos + TTL

### Contexto
Un valor en caché debe permanecer vigente mientras los datos subyacentes no cambien. Mantener cotizaciones o planteles obsoletos viola los requisitos de negocio.

### Decisiones de Invalidación:
1. **Ranking de Jugadores (`GET /players/ranking`)**:
   - **Disparador 1**: Finalización de `QuotationService.recalculateAll()` (manual o por cron semanal). Al terminar de persistir las nuevas `PlayerQuote`, emite `quote.recalculated` o un evento global `recalculation.completed`.
   - **Disparador 2**: Modificación de estrategia activa por el usuario (`PATCH /users/me/strategies/:id/select` o actualización de ponderaciones).
   - **Acción**: Se invalidan todas las claves del ranking pertenecientes a ese usuario usando el patrón `futval:ranking:${userId}:*` vía `delByPrefix`.
   - **TTL de seguridad**: 86400 segundos (24 horas).
2. **Catálogo y Detalle (`GET /players`, `GET /players/:id`)**:
   - **Disparador**: Finalización exitosa de sincronización externa (`POST /sync/whoscored` o `POST /sync/football-data`).
   - **Acción**: Invalidación de los prefijos `futval:catalog:*` y `futval:player:*`.
   - **TTL de seguridad**: 3600 segundos (1 hora).

---

## 5. Fallback explícito ante fallas de APIs externas (Principio I y XIII)

### Contexto
`HttpFootballDataAdapter` consulta la API de Football-Data.org para obtener clasificaciones y escudos de equipos. El plan gratuito de esta API impone límites estrictos de tasa (10 peticiones por minuto, HTTP 429) y caídas temporales de red.

### Decisión de Fallback en Cascada
1. **Nivel 1 (Caché en Redis)**: Toda llamada exitosa a `fetchStandings` o resolución de escudo se guarda en Redis con clave `futval:external:standings:${leagueCode}` o `futval:external:team-crest:${teamName}` con TTL de 7 días (604800 s).
2. **Nivel 2 (Persistencia local en PostgreSQL)**: Si la API externa arroja error HTTP 5xx, timeout (axios > 5000 ms) o HTTP 429:
   - Se captura la excepción en un bloque `try-catch`.
   - Se loguea un aviso con nivel `warn` detallando el error y la activación del fallback.
   - Si Redis tiene los datos cacheados, los devuelve.
   - Si no están en Redis, consulta la tabla local `teams` / `standings` en PostgreSQL.
3. **Nivel 3 (Degradación segura a `null`)**: Si un equipo no tiene escudo en base local ni en caché, se asigna `crestUrl = null` conforme al Principio I y a la especificación de la feature 007 (`FR-006`), evitando arrojar un error 500 al cliente.

---

## 6. Resiliencia de la Caché: Fail-Open

### Contexto
Redis es un acelerador de rendimiento, no la fuente de verdad persistente. La indisponibilidad del broker de Redis no debe tumbar la API de FútVal.

### Decisión
En `RedisCacheService`, todas las operaciones `get`, `set` y `del` están envueltas en bloques `try-catch`.
- Si `ioredis` emite un error de conexión (`ECONNREFUSED`, `ETIMEDOUT`) o falla un comando, el servicio captura el error, emite un log de nivel `warn` y devuelve `null` (en lecturas) o resuelve la promesa sin propagar error (en escrituras/invalidaciones).
- La capa de servicio interpreta el `null` como un *cache miss* y continúa ejecutando la consulta en PostgreSQL con normalidad.

---

## 7. Índices de base de datos según patrones de acceso reales

### Contexto
El Principio XIII exige que los índices se incorporen según patrones de acceso reales medidos, nunca de forma especulativa.

### Análisis de patrones de consulta actuales:
1. **Catálogo de jugadores (`PlayerRepository.findPage`)**:
   - Consulta: `WHERE player.removedAt IS NULL AND player.league = :league AND player.position = :position ORDER BY player.id ASC`.
   - Diagnóstico: Hoy `players` sólo tiene PK `id` y unique `externalId`. Cada filtrado por liga o posición realiza un *Sequential Scan* sobre la tabla completa.
   - Índice óptimo: `CREATE INDEX idx_players_removed_league_position ON players ("removedAt", "league", "position");`
2. **Ranking de jugadores (`PlayerRepository.findRanking`)**:
   - Consulta: Particiona `player_quotes` por `player_id` ordenando por `calculated_at DESC` para `user_id = $1`.
   - Diagnóstico: El índice existente `idx_player_quotes_user_player_date` es ascendente. Para resolver el `latest_quotes` de cada jugador, Postgres debe ordenar o particionar en memoria.
   - Índice óptimo: `CREATE INDEX idx_player_quotes_user_player_calc_desc ON player_quotes ("user_id", "player_id", "calculated_at" DESC);`
   - Optimización de consulta: Con este índice, PostgreSQL ejecuta un *Index Scan* inverso directo para obtener la última cotización de cada jugador del usuario sin necesidad de ordenar todo el histórico acumulado.
