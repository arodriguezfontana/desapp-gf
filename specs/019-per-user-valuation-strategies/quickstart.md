# Quickstart: Estrategias de Valuación Propias por Usuario

## Prerequisitos

- Backend y PostgreSQL local corriendo (`docker-compose up`, luego `nest start` en `backend/`).
- Un usuario de prueba registrado vía `POST /auth/register` (ver 001-user-auth) y su JWT obtenido vía `POST /auth/login`.
- Al menos un jugador existente en el catálogo (ver seed de jugadores de features previas).

## Escenario 1 — Provisioning automático al alta

```bash
curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"user1@test.com","password":"Str0ngP@ss!"}'
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"user1@test.com","password":"Str0ngP@ss!"}' | jq -r .accessToken)

curl -s http://localhost:3000/users/me/strategies -H "Authorization: Bearer $TOKEN"
```

**Esperado**: array con exactamente 2 estrategias (`"Performance general"`,
`"Impacto táctico"`), una con `isSelected: true` — sin ninguna acción adicional
(Historia 1, SC-001).

## Escenario 2 — Cambiar cuál está seleccionada

```bash
TACTICAL_ID=$(curl -s http://localhost:3000/users/me/strategies -H "Authorization: Bearer $TOKEN" \
  | jq -r '.strategies[] | select(.name=="Impacto táctico") | .id')

curl -s -X PATCH http://localhost:3000/users/me/strategies/$TACTICAL_ID/select \
  -H "Authorization: Bearer $TOKEN"

curl -s http://localhost:3000/users/me/strategies -H "Authorization: Bearer $TOKEN"
```

**Esperado**: "Impacto táctico" pasa a `isSelected: true`, "Performance general" a
`false` — exactamente una seleccionada antes y después (Historia 2, SC-002).

## Escenario 3 — Editar pesos con validación de suma

```bash
PERF_ID=$(curl -s http://localhost:3000/users/me/strategies -H "Authorization: Bearer $TOKEN" \
  | jq -r '.strategies[] | select(.name=="Performance general") | .id')

# Suma inválida (> 1.0) -> debe rechazar sin persistir
curl -s -X PATCH http://localhost:3000/users/me/strategies/$PERF_ID/weights \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"weights":{"goals":0.9,"assists":0.9}}'

# Suma válida (=1.0) -> debe aceptar
curl -s -X PATCH http://localhost:3000/users/me/strategies/$PERF_ID/weights \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"weights":{"goals":0.5,"assists":0.5}}'
```

**Esperado**: primer request 400 sin cambios; segundo request 200 con los pesos nuevos
(Historia 3, SC-003).

## Escenario 4 — Valuación al vuelo sin persistir

```bash
PLAYER_ID=<uuid de un jugador existente>

curl -s "http://localhost:3000/players/$PLAYER_ID/quotes" -H "Authorization: Bearer $TOKEN"   # historial antes

curl -s "http://localhost:3000/players/$PLAYER_ID/valuation" -H "Authorization: Bearer $TOKEN"

curl -s "http://localhost:3000/players/$PLAYER_ID/quotes" -H "Authorization: Bearer $TOKEN"   # historial después
```

**Esperado**: ambos historiales (antes/después) son idénticos — la consulta de
valuación no deja rastro (Historia 4, SC-005).

## Escenario 5 — Recálculo manual y lock por usuario

```bash
curl -s -X POST http://localhost:3000/users/me/quotes/recalculate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"playerId\":\"$PLAYER_ID\"}"

curl -s "http://localhost:3000/players/$PLAYER_ID/quotes" -H "Authorization: Bearer $TOKEN"
```

**Esperado**: el historial ahora trae una entrada nueva e inmutable con la estrategia
seleccionada en ese momento (Historia 5/6, SC-006). Para validar el lock (SC-006a),
disparar dos recálculos masivos concurrentes del mismo usuario (sin `playerId`) en
paralelo (p. ej. dos `curl` lanzados casi simultáneamente) y verificar que uno responde
409; repetir con dos usuarios distintos y verificar que ambos responden 200.

## Validación automatizada

La validación completa de estos escenarios vive en los tests de integración/e2e con
Testcontainers (ver tasks.md una vez generado por `/speckit-tasks`), no se duplica aquí
como suite — este documento es solo la guía manual de humo.
