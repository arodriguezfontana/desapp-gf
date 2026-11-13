# Quickstart: validar las métricas de negocio

Guía de validación de punta a punta. Contrato: [contracts/business-metrics.md](contracts/business-metrics.md); series y etiquetas: [data-model.md](data-model.md).

## Prerrequisitos

- Backend con su base disponible (para los e2e, Testcontainers; si no arranca, ver la memoria del proyecto sobre el fallback a la base de desarrollo).
- Para la verificación manual: `cd backend && docker compose up -d` (Postgres + Prometheus `:9090` + Grafana `:3001`) y `pnpm dev` (backend en `:3000`). Credenciales de Grafana: `admin` / `admin`.
- Sin variables de entorno nuevas.

## 1. Tests automáticos

```bash
cd backend
pnpm test                                                   # unit (servicio, mapa de motivos, listeners, services)
pnpm test:e2e -- observability/business-metrics             # e2e de las series
pnpm test:e2e -- observability/business-audit-coverage      # el catálogo de operaciones sigue cerrado
pnpm test -- architecture                                   # tsarch
pnpm lint && pnpm build
```

Casos unitarios (sin base) que se suman a los escenarios:

- `classifySyncRun`: todas las unidades bien → `success`; mezcla → `partial`; ninguna buena o abortó → `failure`; sin unidades fallidas → `success`.
- `recalculateAll` sin `trigger` **no compila**: el spec lo fija con `// @ts-expect-error` (si alguien le vuelve a poner un default, el spec deja de compilar).
- `QuotationService.handleCron()` llama a `recalculateAll('scheduled')` e incrementa `scheduled`, nunca `manual`.
- `MarketSimulationService.simulate()` mide `manual` una sola vez y **no** invoca `recalculateAll` (falla si lo hace mientras mide por su cuenta).
- Un `BusinessMetrics` que lanza no altera el resultado de la operación medida en ningún service instrumentado.

Escenarios cubiertos por el e2e (`test/observability/business-metrics.e2e-spec.ts`):

1. **Compra exitosa**: sube `business_operations_total{operation="TOKENS_BOUGHT",outcome="success"}`, `market_tokens_traded_total{side="buy"}` y `market_volume_credits_total{side="buy"}`.
2. **Venta sin tokens**: sube `market_order_rejections_total{reason="insufficient_tokens"}` y `business_operations_total{...,outcome="rejected"}`; **no** sube ningún contador de éxito, tokens ni volumen.
3. **Etiquetas cerradas**: todos los valores de `operation`, `outcome`, `side`, `reason`, `source`, `trigger` y `delivery` de `/metrics` pertenecen a los conjuntos de [data-model.md](data-model.md).
4. **Presencia**: `/metrics` expone las doce familias.
5. **Medir no altera**: con el `BusinessMetrics` forzado a fallar internamente, la compra responde igual.
6. **Recálculo manual** (`POST /quotes/recalculate`): sube `quote_recalculations_total{trigger="manual",outcome="success"}` y observa la duración.
7. **Última sync exitosa**: tras una corrida `success` aparece el gauge y avanza; una `failure` y una `partial` no lo cambian ni lo crean; al recrear la app sobre la misma base, el gauge se siembra desde `sync_last_success`.
8. **Corrida `partial`** (caso nuevo): con un adapter de prueba en el que algunas unidades fallan y otras no, `sync_runs_total{outcome="partial"}` sube en 1, no suben `success` ni `failure`, la duración se observa y `sync_last_success_timestamp_seconds` no cambia (ausente si nunca hubo `success`). Sin ninguna unidad buena la misma corrida cuenta `failure`; con todas buenas, `success`.
9. **Cron programado**: invocar `handleCron()` del recálculo de cotizaciones incrementa `quote_recalculations_total{trigger="scheduled"}` y no `manual`; `POST /quotes/recalculate` incrementa `manual`. Lo mismo en los `handleCron`/`sync()` de sync con `sync_runs_total`.
10. **Simulación sin doble conteo**: `POST /admin/simulate-market` incrementa `quote_recalculations_total{trigger="manual"}` exactamente en 1.
11. **HELP**: `/metrics` incluye las aclaraciones de `business_operations_total` ("corrida aceptada, no terminada") y de `market_order_rejections_total` ("sólo el alta de órdenes").
12. **Notificaciones**: alerta disparada con el usuario conectado al stream → `delivery="live"`; sin conexión → `delivery="stored_only"`; `sse_connections_active` baja a 0 al cerrar.

## 2. Verificación manual (Prometheus y Grafana)

1. Con el backend corriendo, generar tráfico: registrarse, comprar y vender tokens (una venta de más tokens de los que se tienen), `POST /quotes/recalculate` y `POST /sync/football-data` con la API key de admin, y abrir `GET /notifications/stream` con un usuario con una alerta activa.
2. `curl http://localhost:3000/metrics` y comprobar las series del contrato.
3. Prometheus (`http://localhost:9090`): ejecutar las consultas de la tabla del contrato y comprobar que devuelven datos; `/targets` con `futval-backend` en **UP**.
4. Grafana (`http://localhost:3001/d/futval-http-metrics`): verificar la fila **Negocio** (operaciones por resultado, tokens y volumen, rechazos por motivo, sync por fuente con duración y antigüedad, recálculos, alertas/notificaciones y conexiones SSE) sin paneles "No data" donde hubo actividad.
5. Reiniciar el backend: los contadores vuelven a 0 y la antigüedad de la última sync de cada fuente se conserva.

## 3. Calibración pendiente

Los buckets de duración (sync y recálculo) son provisorios. Tras medir una corrida real, anotar acá la duración observada y ajustarlos si la mayoría de las muestras cae en un solo bucket.

| Medición | Duración observada | Ajuste |
|----------|--------------------|--------|
| Sync Football-Data | 85,3 s (1 corrida real, manual, `success`; cae en el bucket de 60–120 s) | Ninguno: los buckets 60/120 la acotan bien |
| Sync WhoScored | no medida (implica scrapear el sitio real; se verificó con adapters de prueba en el e2e) | Pendiente de la primera corrida real; los buckets llegan hasta 1800 s |
| Recálculo | ≈ 4,1 s en promedio (6 recálculos manuales sobre la base de desarrollo; cae en el bucket de 2,5–5 s) | Ninguno: la escala 0,05–300 s la cubre |

## Verificación manual realizada (T050 y T055)

El 2026-11-13, con Prometheus y Grafana levantados y el backend en el host: se generó tráfico (registro, venta sin tokens, compra, alerta + recálculo con y sin stream SSE abierto y una sincronización real de Football-Data).

- `/metrics` expuso las 12 familias con los valores esperados (`insufficient_tokens`, `manual/success`, `live` y `stored_only`, `sse_connections_active` de vuelta en 0).
- Prometheus: `futval-backend` en **UP**.
- Grafana: el dashboard provisionado trae la fila **Negocio**; las consultas de sus 12 paneles devuelven datos a través del datasource.
- Reinicio del backend: los contadores vuelven a 0 y `sync_last_success_timestamp_seconds{source="football_data"}` conserva el mismo valor.
- No se ejecutó la sincronización de WhoScored (scraping real).
