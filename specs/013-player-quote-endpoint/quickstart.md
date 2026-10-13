# Quickstart: Validación de Consulta de Cotización de Jugador

Guía rápida para validar el funcionamiento del endpoint `GET /players/:id/quote`.

## Prerrequisitos

1. Base de datos PostgreSQL levantada y migraciones aplicadas.
2. Clave API de prueba generada o configurada en variables de entorno.
3. Al menos un jugador registrado en la base de datos (por seed o catálogo existente).

---

## Escenarios de Validación

### Escenario 1: Cotización más reciente (sin parámetro `at`)

1. Asegurar que existe al menos una cotización para el jugador:
   - Se puede ejecutar el recálculo vía `POST /quotes/recalculate` con `AdminApiKey` o insertar un registro de prueba.
2. Realizar petición:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quote" \
     -H "x-api-key: <API_KEY>"
   ```
3. **Resultado esperado**:
   - HTTP 200 OK.
   - Body JSON con `playerId`, `valor`, `score`, `strategyName`, `weights`, `calculatedAt`.

---

### Escenario 2: Cotización histórica vigente (con parámetro `at`)

1. Para un jugador con cotizaciones en fechas `2026-09-10` y `2026-09-20`:
2. Consultar con fecha intermedia:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quote?at=2026-09-15" \
     -H "x-api-key: <API_KEY>"
   ```
3. **Resultado esperado**:
   - HTTP 200 OK.
   - Retorna la cotización del `2026-09-10` (la más reciente anterior o igual al final del día `2026-09-15T23:59:59.999Z`).

---

### Escenario 3: Sin cotización para la fecha (204 No Content)

1. Consultar con una fecha previa a la primera cotización del jugador:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quote?at=2020-01-01" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - HTTP 204 No Content.
   - Cuerpo vacío (0 bytes).

---

### Escenario 4: Fecha inválida (400 Bad Request)

1. Enviar una fecha malformada:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quote?at=invalido" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - HTTP 400 Bad Request.
   - Mensaje de error descriptivo indicando formato de fecha inválido.

---

### Escenario 5: Jugador inexistente (404 Not Found)

1. Consultar con un UUID inexistente:
   ```bash
   curl -X GET "http://localhost:3000/players/00000000-0000-0000-0000-000000000000/quote" \
     -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**:
   - HTTP 404 Not Found.
   - Mensaje `No se encontró el jugador solicitado.`.

---

### Escenario 6: Sin autenticación (401 Unauthorized)

1. Realizar llamada sin header:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quote"
   ```
2. **Resultado esperado**:
   - HTTP 401 Unauthorized.

