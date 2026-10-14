# Quickstart: Validación de Ranking de Jugadores (GET /players/ranking)

Guía rápida para validar el funcionamiento del endpoint `GET /players/ranking`.

## Prerrequisitos

1. Base de datos PostgreSQL levantada con esquema inicial y migraciones aplicadas.
2. Clave API de prueba válida emitida para el header `x-api-key`.
3. Al menos 2 o más jugadores registrados en `players` con cotizaciones calculadas en `player_quotes`.

---

## Escenarios de Validación

### Escenario 1: Ranking general ordenado por valor (Paginación por defecto)

1. Ejecutar petición sin filtros de query:
   ```bash
   curl -X GET "http://localhost:3000/players/ranking" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - Status HTTP `200 OK`.
   - Body JSON conteniendo `items` (máximo 10 elementos), `total`, `page: 1` y `pageSize: 10`.
   - El primer elemento tiene `rank: 1` y el mayor `valor`.
   - Los elementos sucesivos tienen `rank: 2`, `rank: 3`, etc. y valores menores o iguales al anterior (`items[i].valor >= items[i+1].valor`).
   - Cada elemento incluye `valor`, `score`, `strategyName` y atributos del jugador.

---

### Escenario 2: Navegación de páginas continuas

1. Solicitar la página 2 con tamaño reducido:
   ```bash
   curl -X GET "http://localhost:3000/players/ranking?page=2&pageSize=5" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - Status HTTP `200 OK`.
   - Los jugadores devueltos tienen posiciones `rank: 6`, `rank: 7`, `rank: 8`, `rank: 9`, `rank: 10`.
   - `total` refleja el total general de jugadores cotizados sin alterar por la página.

---

### Escenario 3: Filtrado por liga y posición

1. Solicitar los delanteros de La Liga:
   ```bash
   curl -X GET "http://localhost:3000/players/ranking?league=La%20Liga&position=FW" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - Status HTTP `200 OK`.
   - Todos los jugadores retornados cumplen `league == "La Liga"` y `position == "FW"`.
   - `rank` comienza en `1` para el mejor delantero de dicha liga.

---

### Escenario 4: Búsqueda sin coincidencias (200 OK con lista vacía)

1. Solicitar un filtro inexistente o equipo sin cotizaciones:
   ```bash
   curl -X GET "http://localhost:3000/players/ranking?team=EquipoInexistenteXYZ" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - Status HTTP `200 OK` (no 404).
   - Body: `{"items": [], "total": 0, "page": 1, "pageSize": 10}`.

---

### Escenario 5: Parámetros inválidos (400 Bad Request)

1. Enviar un tamaño de página excesivo o liga inválida:
   ```bash
   curl -X GET "http://localhost:3000/players/ranking?pageSize=999" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - Status HTTP `400 Bad Request`.
   - Mensaje de validación indicando que `pageSize` no puede superar 50.

---

### Escenario 6: Acceso no autenticado (401 Unauthorized)

1. Enviar petición sin cabecera `x-api-key`:
   ```bash
   curl -X GET "http://localhost:3000/players/ranking"
   ```
2. **Resultado esperado**:
   - Status HTTP `401 Unauthorized`.
   - Cuerpo de error estructurado por `AllExceptionsFilter`.

---

## Ejecución de Tests Automatizados

```bash
# Unit tests
pnpm test:unit -- src/controllers/player/player.controller.spec.ts src/services/player/player-enrichment.service.spec.ts

# Integration tests
pnpm test:integration -- src/repositories/player/typeorm-player.repository.integration.spec.ts

# E2E tests
pnpm test:e2e -- test/player/player-ranking.e2e.spec.ts
```

