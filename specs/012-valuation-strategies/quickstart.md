# Quickstart: Estrategias de Valuación de Jugadores

Guía de validación para verificar que la feature funciona correctamente de extremo a extremo.

## Prerrequisitos

- Docker corriendo (para PostgreSQL local y Testcontainers en tests)
- `pnpm install` ejecutado en `backend/`
- Base de datos local levantada: `docker-compose up -d`
- Migraciones aplicadas: `pnpm -C backend migration:run`
  - Esto incluye la migration seed de las dos estrategias de valuación
- API key de admin disponible (obtenible vía `POST /api-keys` con rol ADMIN, o de los seeds de tests)

## Escenarios de validación

### 1. Verificar seed de estrategias

Tras correr las migraciones, consultar la base de datos:

```sql
SELECT id, name, is_active, factor_escala FROM valuation_strategies;
```

**Esperado**:
- 2 filas: "Performance general" (is_active=true) e "Impacto táctico" (is_active=false)
- Ambas con factor_escala=99

### 2. Disparar recálculo manual

```bash
curl -X POST http://localhost:3000/quotes/recalculate \
  -H "x-api-key: <admin-api-key>"
```

**Esperado (200 OK)**:
```json
{
  "processedPlayers": <N>,
  "errors": 0,
  "durationMs": <tiempo>
}
```
donde `N` es el número de jugadores activos en la base de datos.

### 3. Verificar cotizaciones persistidas

```sql
SELECT pq.player_id, pq.score, pq.value, pq.calculated_at
FROM player_quotes pq
ORDER BY pq.calculated_at DESC
LIMIT 10;
```

**Esperado**:
- Filas para cada jugador activo
- `value` entre 1 y 100 para jugadores con métricas típicas (estrategia activa: "Performance general", factorEscala=99)
- `score` entre 0 y 1 (o negativo si métricas disciplinarias dominan, con estrategia que las penalice)

### 4. Verificar snapshot de pesos

```sql
SELECT weight_snapshot, factor_escala_snapshot
FROM player_quotes
LIMIT 1;
```

**Esperado**:
- `weight_snapshot` contiene los pesos de la estrategia "Performance general"
- `factor_escala_snapshot` = 99

### 5. Comportamiento de concurrencia — 409

Enviar dos requests simultáneas (en ventanas de terminal separadas):

```bash
# Terminal 1
curl -X POST http://localhost:3000/quotes/recalculate -H "x-api-key: <admin-api-key>"
# Terminal 2 (inmediatamente)
curl -X POST http://localhost:3000/quotes/recalculate -H "x-api-key: <admin-api-key>"
```

**Esperado**: Una de las dos respuestas es `409 Conflict`.

### 6. Sin API key — 401

```bash
curl -X POST http://localhost:3000/quotes/recalculate
```

**Esperado**: `401 Unauthorized`

### 7. Ejecutar la suite de tests unitarios de dominio

```bash
pnpm -C backend test:unit --testPathPattern=quotation
```

**Esperado**: Todos los tests en verde. Los tests de `calculate-player-value.ts` deben cubrir:
- Jugador con todas las métricas completas
- Jugador con métricas null (tratadas como 0)
- Jugador con métricas que superan el bound (normalizadas a 1.0)
- Estrategia con pesos negativos (score puede ser negativo)
- Verificación de que `value = 1 + score * factorEscala`

### 8. Ejecutar tests end-to-end

```bash
pnpm -C backend test:e2e --testPathPattern=quotation
```

**Esperado**: Todos los tests en verde. Los tests e2e deben cubrir los escenarios de los acceptance scenarios del spec.

## Referencias

- Contrato API: [quotes-api.md](./contracts/quotes-api.md)
- Modelo de datos: [data-model.md](./data-model.md)
- Spec completa: [spec.md](./spec.md)
