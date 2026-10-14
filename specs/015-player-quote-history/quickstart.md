# Quickstart: Validación del Historial de Cotizaciones

Guía rápida para validar `GET /players/:id/quotes` y el gráfico de evolución en el frontend.

## Prerrequisitos

1. Base de datos PostgreSQL levantada (sin migrations nuevas que aplicar — esta feature no agrega columnas).
2. Catálogo de jugadores existente y al menos una estrategia activa (012-valuation-strategies).
3. Clave API estándar (no admin) — ver 008-admin-role-api-key.

---

## Escenarios de Validación

### Escenario 1: Historial con varias cotizaciones, orden ascendente

1. Disparar el recálculo manual más de una vez, con algo de tiempo entre medio (o insertar filas de prueba directamente en `player_quotes` con `calculated_at` distintos):
   ```bash
   curl -X POST "http://localhost:3000/quotes/recalculate" -H "x-api-key: <ADMIN_API_KEY>"
   # (esperar / cambiar de estrategia activa / recalcular de nuevo si se quiere variedad)
   curl -X POST "http://localhost:3000/quotes/recalculate" -H "x-api-key: <ADMIN_API_KEY>"
   ```
2. Consultar el historial de un jugador:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quotes" -H "x-api-key: <API_KEY>"
   ```
3. **Resultado esperado**: HTTP 200, array con una entrada por cada recálculo, ordenado por `calculatedAt` ascendente (ver contrato en [contracts/player-quotes-history-api.md](./contracts/player-quotes-history-api.md)).

---

### Escenario 2: Jugador existente sin cotizaciones → 200 con array vacío

1. Elegir un jugador del catálogo que nunca haya sido procesado por un recálculo (o truncar sus `player_quotes` de prueba).
2. Consultar su historial:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_SIN_QUOTES_ID>/quotes" -H "x-api-key: <API_KEY>"
   ```
3. **Resultado esperado**: HTTP 200, cuerpo `[]`. Nunca 404.

---

### Escenario 3: Jugador inexistente → 404

```bash
curl -X GET "http://localhost:3000/players/00000000-0000-0000-0000-000000000000/quotes" -H "x-api-key: <API_KEY>"
```

**Resultado esperado**: HTTP 404.

---

### Escenario 4: Frontend — gráfico de evolución en la ficha del jugador

1. Levantar el frontend con el backend corriendo y al menos un jugador con 2+ cotizaciones (Escenario 1).
2. Abrir `/catalog/<PLAYER_ID>`.
3. **Resultado esperado**: debajo de la información principal del jugador se renderiza un gráfico de líneas con un punto por cotización; el eje X corresponde a `calculatedAt` y el eje Y a `value`.
4. Abrir la ficha de un jugador sin cotizaciones (Escenario 2).
5. **Resultado esperado**: en lugar del gráfico, se muestra un estado vacío explícito (spec FR-009) — nunca un gráfico roto o sin puntos.

---

### Escenario 5: Validación de dominio y repositorio (sin UI)

```bash
cd backend && npx jest player-quote-history quotation.service
```

**Resultado esperado**: todos los casos pasan, incluyendo: orden ascendente, lista vacía para jugador sin cotizaciones, `PlayerNotFoundError` para jugador inexistente.
