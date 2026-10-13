# Quickstart: Validación de Perfiles de Pesos por Posición

Guía rápida para validar que la selección automática de perfil de posición (o fallback a pesos generales) funciona end-to-end, y que el frontend refleja el origen de la cotización.

## Prerrequisitos

1. Base de datos PostgreSQL levantada y migraciones aplicadas, incluyendo `AddPositionWeightsColumns` y `SeedPositionWeightProfiles` (ver [data-model.md](./data-model.md)).
2. Catálogo de jugadores existente con al menos un jugador por cada posición (FW, MF, DF, GK) — reutilizar el catálogo de 004-player-catalog / 006-whoscored-catalog-sync.
3. Clave API configurada (ApiKey de admin para `recalculate`, ApiKey estándar para consultar cotizaciones) — ver 008-admin-role-api-key.
4. "Performance general" activa (seed por defecto, igual que en 012-valuation-strategies).

---

## Escenarios de Validación

### Escenario 1: Jugador con perfil de posición aplicable

1. Disparar el recálculo masivo:
   ```bash
   curl -X POST "http://localhost:3000/quotes/recalculate" -H "x-api-key: <ADMIN_API_KEY>"
   ```
2. Consultar la cotización de un jugador FW (ver contrato [quote-response-delta.md](./contracts/quote-response-delta.md)):
   ```bash
   curl -X GET "http://localhost:3000/quotes/player/<FW_PLAYER_ID>" -H "x-api-key: <API_KEY>"
   ```
3. **Resultado esperado**: HTTP 200, `appliedPosition: "FW"`. El `score` corresponde a aplicar únicamente `goals=0.45, shots=0.25, assists=0.15, rating=0.15` (perfil FW de "Performance general"), no los pesos generales de la estrategia.

---

### Escenario 2: Estrategia sin perfil para la posición del jugador → fallback a pesos generales

1. Con "Performance general" activa (define perfil para las 4 posiciones), verificar el caso de fallback usando el endpoint de detalle, que expone también `weights`:
   ```bash
   curl -X GET "http://localhost:3000/players/<PLAYER_ID>/quote" -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado** (para un jugador cuya posición sí tiene perfil): `appliedPosition` no es `null` y `weights` coincide con el perfil de esa posición, no con los pesos generales de la estrategia.
3. Para validar el camino de fallback explícitamente, usar un test de integración (`quotation.service.integration.spec.ts`) con una estrategia de prueba que solo define perfil para una posición y verificar que un jugador de otra posición recibe `appliedPosition: null` y `weightSnapshot` igual a `strategy.weights`.

---

### Escenario 3: Activar "Impacto táctico" y verificar que cambian tanto los pesos generales como los perfiles aplicados

1. Activar la segunda estrategia:
   ```bash
   curl -X PATCH "http://localhost:3000/quotes/strategies/b2c3d4e5-f6a7-8901-bcde-f12345678901/activate" -H "x-api-key: <ADMIN_API_KEY>"
   ```
2. Recalcular y volver a consultar el mismo jugador FW del Escenario 1:
   ```bash
   curl -X POST "http://localhost:3000/quotes/recalculate" -H "x-api-key: <ADMIN_API_KEY>"
   curl -X GET "http://localhost:3000/quotes/player/<FW_PLAYER_ID>" -H "x-api-key: <API_KEY>"
   ```
3. **Resultado esperado**: `appliedPosition: "FW"` (sigue aplicando perfil, ahora el de "Impacto táctico": `goals=0.45, shots=0.25, assists=0.15, rating=0.20, yellowCards=-0.05`), y el `score` difiere del Escenario 1 porque el perfil de "Impacto táctico" penaliza `yellowCards`.

---

### Escenario 4: Reproducibilidad histórica tras cambiar de estrategia

1. Repetir la consulta del Escenario 1 (antes de activar "Impacto táctico"), usando el endpoint con parámetro `at` apuntando a la fecha del primer recálculo:
   ```bash
   curl -X GET "http://localhost:3000/players/<FW_PLAYER_ID>/quote?at=<FECHA_ESCENARIO_1>" -H "x-api-key: <API_KEY>"
   ```
2. **Resultado esperado**: la cotización histórica conserva `appliedPosition: "FW"` y `weights` con los valores del perfil FW de "Performance general", sin verse afectada por la activación posterior de "Impacto táctico" (spec Edge Case, DD-002).

---

### Escenario 5: Frontend — indicador de perfil de posición en la ficha del jugador

1. Levantar el frontend (`pnpm --filter frontend dev`) con el backend corriendo y al menos una cotización calculada.
2. Abrir `/players/<FW_PLAYER_ID>` en el navegador.
3. **Resultado esperado**: la ficha del jugador indica que la cotización vigente se calculó con el perfil de posición FW (no con los pesos generales).
4. Repetir para un jugador cuya posición no tenga perfil aplicable en la estrategia activa (si existiera tal caso en los datos de seed) y verificar que la ficha indica "pesos generales" en su lugar.

---

### Escenario 6: Validación de dominio puro (sin base de datos)

Ejecutar los tests unitarios extendidos de `calculate-player-value.spec.ts` y `valuation-strategy.spec.ts`:

```bash
cd backend && npx jest calculate-player-value valuation-strategy
```

**Resultado esperado**: todos los casos pasan, incluyendo: perfil presente con subconjunto de métricas, perfil ausente para la posición del jugador, estrategia sin ningún `positionWeights` definido, y rechazo de un perfil cuya suma de pesos no sea 1.0 (±0.001).
