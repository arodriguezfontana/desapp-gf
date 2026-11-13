# Contrato: métricas de negocio en `GET /metrics`

No se agregan endpoints: las series salen en el `GET /metrics` existente (público, formato de texto de Prometheus; ver [029](../../029-http-metrics-sla/contracts/metrics-api.md)). Este contrato fija nombres, tipos, etiquetas y semántica; los valores de etiquetas están en [data-model.md](../data-model.md).

## Series expuestas

```text
# HELP business_operations_total Operaciones de escritura de la API por tipo y resultado. success significa operación aceptada: para PLAYER_SYNC_TRIGGERED es corrida aceptada, no corrida terminada.
# TYPE business_operations_total counter
business_operations_total{operation="TOKENS_BOUGHT",outcome="success"} 3
business_operations_total{operation="TOKENS_SOLD",outcome="rejected"} 1

# TYPE market_tokens_traded_total counter
market_tokens_traded_total{side="buy"} 12

# TYPE market_volume_credits_total counter
market_volume_credits_total{side="buy"} 1480.5

# HELP market_order_rejections_total Órdenes de compra y venta rechazadas al crearse, por motivo. Mide sólo el alta de órdenes: no incluye las cancelaciones.
# TYPE market_order_rejections_total counter
market_order_rejections_total{reason="insufficient_tokens"} 1

# TYPE sync_runs_total counter
sync_runs_total{source="whoscored",trigger="manual",outcome="success"} 1
sync_runs_total{source="football_data",trigger="scheduled",outcome="partial"} 1

# TYPE sync_run_duration_seconds histogram
sync_run_duration_seconds_bucket{source="football_data",trigger="scheduled",le="60"} 0

# TYPE sync_last_success_timestamp_seconds gauge
sync_last_success_timestamp_seconds{source="whoscored"} 1.7945e+09

# TYPE quote_recalculations_total counter
quote_recalculations_total{trigger="manual",outcome="success"} 2

# TYPE quote_recalculation_duration_seconds histogram
quote_recalculation_duration_seconds_bucket{trigger="manual",le="1"} 2

# TYPE alerts_triggered_total counter
alerts_triggered_total 1

# TYPE notifications_created_total counter
notifications_created_total{delivery="live"} 1
notifications_created_total{delivery="stored_only"} 0

# TYPE sse_connections_active gauge
sse_connections_active 1
```

## Reglas del contrato

1. **Nombres y tipos fijos** (los de la tabla de [data-model.md](../data-model.md)); no se renombran sin una nueva spec.
2. **Resultados de sync**: `success` (todas las unidades bien), `partial` (algunas fallaron y otras no) y `failure` (abortó o ninguna terminó bien); ver [data-model.md](../data-model.md). Los recálculos sólo tienen `success` y `failure`.
3. **Etiquetas cerradas**: cualquier valor fuera de los conjuntos definidos es un defecto. Un error de dominio sin motivo conocido va a `reason="other"`; nunca crea una serie nueva.
4. **Sólo lo que ocurrió**: `outcome="success"`, `market_tokens_traded_total` y `market_volume_credits_total` sólo suben cuando la operación quedó registrada (después del commit). Una rechazada o fallida jamás los incrementa.
5. **Series ausentes antes del primer evento**: los contadores etiquetados aparecen al primer incremento; `sync_last_success_timestamp_seconds{source}` está ausente hasta que exista una corrida `success` de esa fuente (persistida y sembrada al arrancar); una corrida `partial` o `failure` no la crea ni la mueve. `alerts_triggered_total` y `sse_connections_active` (sin etiquetas) existen desde el arranque en 0.
6. **Reinicio**: todo vuelve a 0 al reiniciar el backend, salvo `sync_last_success_timestamp_seconds`.
7. **Sin efecto sobre la operación medida**: un fallo al medir no cambia la respuesta ni el resultado.
8. **Sin SLA ni endpoints nuevos**; Swagger y la colección de Postman no cambian.

## Consultas de referencia (PromQL, usadas por el dashboard)

| Panel | Consulta |
|-------|----------|
| Operaciones por resultado | `sum by (outcome) (rate(business_operations_total[5m]))` |
| Tokens y volumen por lado | `sum by (side) (rate(market_tokens_traded_total[5m]))`, `sum by (side) (rate(market_volume_credits_total[5m]))` |
| Rechazos por motivo | `sum by (reason) (rate(market_order_rejections_total[15m]))` |
| Corridas de sync | `sum by (source, outcome) (increase(sync_runs_total[1d]))` |
| Duración p95 de sync | `histogram_quantile(0.95, sum by (le, source) (rate(sync_run_duration_seconds_bucket[1d])))` |
| Antigüedad de la última sync | `time() - sync_last_success_timestamp_seconds` |
| Recálculos | `sum by (trigger, outcome) (increase(quote_recalculations_total[1d]))` |
| Notificaciones por entrega | `sum by (delivery) (increase(notifications_created_total[1h]))` |
| Conexiones SSE | `sse_connections_active` |
