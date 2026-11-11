# Quickstart: validar el snapshot de saldo y el backfill

Guía de validación; las reglas están en [data-model.md](data-model.md) y la interfaz del script en
[contracts/backfill-cli.md](contracts/backfill-cli.md).

## Prerrequisitos

- Docker en marcha: `docker info` debe responder **antes** de correr integración/e2e (si está apagado, el setup de tests cae en silencio a la base de desarrollo y los tests **borran datos**).
- `cd backend && pnpm install`.

## 1. Automático

```bash
cd backend
pnpm test:unit            # dominio (snapshots, cadena, emisión), tsarch
pnpm test:integration     # backfill y migración de esquema (Testcontainers)
pnpm test:e2e             # incluye test/token-balance-snapshot.e2e-spec.ts
pnpm build
pnpm lint
```

Esperado: todo en verde. Los e2e cubren: compra y venta con los dos saldos correctos para ambas partes, auto-cruce,
varios fills sobre una misma tenencia (cadena continua), atomicidad (falla forzada → cero asientos y tenencias
intactas), emisión inicial (0 → 100, idempotente al reiniciar, la primera venta parte de 100) y el historial y el
portafolio idénticos con el asiento de emisión presente.

## 2. Manual del backfill (contra una base desechable, no la de desarrollo)

```bash
docker run -d --name t030_pg -e POSTGRES_PASSWORD=t030 -e POSTGRES_DB=t030 -p 5545:5432 postgres:16-alpine
cd backend && pnpm build
# 1) arrancar el backend una vez contra esa base para que cree el esquema (y detenerlo)
PORT=3102 DATABASE_URL="postgresql://postgres:t030@127.0.0.1:5545/t030" NODE_ENV=test node dist/src/main
```

| Paso | Qué hacer | Esperado |
|------|-----------|----------|
| Datos legacy | Insertar a mano (SQL) un usuario, un jugador, dos órdenes y 3–4 asientos `CREDIT`/`DEBIT` con `balance_before/after` en `NULL`, y la tenencia con la cantidad final | filas con saldos nulos |
| Simulación | `DATABASE_URL=… pnpm db:backfill-token-balances --dry-run` | `OK(dry)` por tenencia, resumen con `asientos actualizados: 0`, la base sin cambios |
| Aplicar | `DATABASE_URL=… pnpm db:backfill-token-balances` | `OK`, código de salida 0; el último `balance_after` de cada tenencia == `token_holdings.quantity` |
| Idempotencia | volver a correrlo | todo `YA-COMPLETA`, mismas filas |
| Inconsistencia | cambiar a mano la cantidad de una tenencia y volver a correr (con otra tenencia sana sin completar) | una línea `INCONSISTENTE`, la sana `OK`, código de salida 1, la inconsistente sin tocar |
| Superusuario | un usuario con `username = 'superuser'` cuyo primer asiento es un `DEBIT` y cuya tenencia = 100 − neto | `OK … apertura=100` |

Al final: `docker rm -f t030_pg`.

## 3. Verificación de integridad (SQL de apoyo)

```sql
-- asientos sin saldos (debe ser 0 antes del paso 2)
SELECT count(*) FROM token_transactions WHERE balance_before IS NULL OR balance_after IS NULL;

-- el último saldo de cada tenencia coincide con la tenencia (debe devolver 0 filas)
SELECT h.user_id, h.player_id, h.quantity, t.balance_after
FROM token_holdings h
JOIN LATERAL (SELECT balance_after FROM token_transactions t
              WHERE t.user_id = h.user_id AND t.player_id = h.player_id
              ORDER BY created_at DESC, (type = 'DEBIT') DESC LIMIT 1) t ON true
WHERE t.balance_after <> h.quantity;
```

## 4. Documentación

- Swagger y Postman: **sin cambios** (ningún endpoint ni respuesta cambia).
- Este quickstart y el contrato del script son la documentación del backfill y de la decisión de diseño.
