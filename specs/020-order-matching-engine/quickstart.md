# Quickstart: Superusuario y motor de matching de órdenes

## Prerequisitos

- Backend y PostgreSQL local corriendo (`docker-compose up`, luego `nest start` en `backend/`).
- `SUPERUSER_EMAIL`/`SUPERUSER_PASSWORD` configuradas en `.env` (mismo contrato que
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`) para que el seed del superusuario corra al arrancar.
- Al menos un jugador existente en el catálogo (ver seed de jugadores de features previas).
- Dos usuarios de prueba registrados vía `POST /auth/register` (con `username` ahora
  requerido) y sus JWT obtenidos vía `POST /auth/login`.

## Escenario 1 — Username reservado

```bash
curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"intruso@test.com","password":"Str0ngP@ss!","username":"superuser"}'
```

**Esperado**: 409 — ningún usuario nuevo creado (spec Historia 1, SC-001).

## Escenario 2 — Liquidez inicial del superusuario

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SUPERUSER_EMAIL\",\"password\":\"$SUPERUSER_PASSWORD\"}" | jq -r .accessToken)
PLAYER_ID=<uuid de un jugador existente>

curl -s "http://localhost:3000/players/$PLAYER_ID/valuation" -H "Authorization: Bearer $TOKEN"
```

**Esperado**: existe exactamente una `Order` SELL PENDING del superusuario por ese
jugador, por 100 tokens, al precio que devuelve este mismo `valuation` (spec Historia 2,
SC-002/SC-003) — verificable inspeccionando la tabla `orders` o, si se expone, un futuro
listado de órdenes propias (fuera de alcance de esta feature más allá de la creación).

## Escenario 3 — Publicar una orden sin precio y verificar matching exacto

```bash
# user1 registra con username (no único)
curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"user1@test.com","password":"Str0ngP@ss!","username":"inversor"}'
TOKEN1=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"user1@test.com","password":"Str0ngP@ss!"}' | jq -r .accessToken)

# user1 compra 10 tokens del mismo jugador que el superusuario vende (mismo precio, porque
# la estrategia default es la misma seed para todo usuario nuevo)
curl -s -X POST http://localhost:3000/orders -H "Authorization: Bearer $TOKEN1" \
  -H 'Content-Type: application/json' \
  -d "{\"side\":\"BUY\",\"playerId\":\"$PLAYER_ID\",\"quantity\":10}"
```

**Esperado**: la orden de user1 se crea con el precio calculado automáticamente (igual
al de `GET /players/:id/valuation` para user1 y ese jugador) y matchea de inmediato
contra la orden SELL del superusuario (mismo precio exacto, por tener ambos la misma
estrategia default seed): `status: "COMPLETED"`, `remainingQuantity: 0`, con un `fills`
de longitud 1 (spec Historia 3/4, SC-003/SC-005).

## Escenario 4 — Fill parcial y remanente como orden pendiente

```bash
curl -s -X POST http://localhost:3000/orders -H "Authorization: Bearer $TOKEN1" \
  -H 'Content-Type: application/json' \
  -d "{\"side\":\"BUY\",\"playerId\":\"$PLAYER_ID\",\"quantity\":95}"
```

**Esperado** (continuando del escenario 3, donde ya se consumieron 10 de los 100 del
superusuario, quedando 90 disponibles en esa única orden SELL): se ejecutan 90 contra la
orden SELL restante del superusuario (que queda `COMPLETED`), y los 5 restantes de la
orden de user1 quedan como `remainingQuantity: 5`, `status: "PARTIALLY_FILLED"`, sin
ninguna contraparte adicional disponible (spec Historia 4, escenario 3).

## Escenario 5 — Sin contraparte compatible

```bash
curl -s -X POST http://localhost:3000/orders -H "Authorization: Bearer $TOKEN1" \
  -H 'Content-Type: application/json' \
  -d "{\"side\":\"SELL\",\"playerId\":\"<otro-player-id-sin-ordenes-previas>\",\"quantity\":5}"
```

**Esperado**: 400 si user1 no tiene holding de ese jugador (FR-010); si sí lo tiene (p.
ej. tras un fill previo), la orden queda `status: "PENDING"`, `remainingQuantity: 5`,
`fills: []` (spec Historia 4, escenario 4, SC-006).

## Escenario 6 — Concurrencia (SC-008)

Disparar dos `POST /orders` compatibles entre sí (mismo jugador, lados opuestos, mismo
precio) casi simultáneamente contra la misma orden PENDING existente (p. ej. dos
`curl` lanzados en paralelo desde dos usuarios distintos contra la orden remanente del
escenario 4). **Esperado**: la suma de los fills ejecutados contra esa orden nunca
excede su `remainingQuantity` disponible al momento de la carrera — verificable
inspeccionando que `remainingQuantity` final nunca sea negativo y que la suma de
`quantity` de los `TokenTransaction` asociados a esa orden coincida exactamente con lo
efectivamente fileado.

## Validación automatizada

La validación completa de estos escenarios (incluyendo el caso de concurrencia) vive en
los tests de integración/e2e con Testcontainers (ver tasks.md una vez generado por
`/speckit-tasks`), no se duplica aquí como suite — este documento es solo la guía manual
de humo.
