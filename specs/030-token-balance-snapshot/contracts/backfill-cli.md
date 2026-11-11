# Contract: script de backfill de saldos

La feature **no cambia ningún endpoint** (Swagger y Postman sin cambios). Su única interfaz nueva es un script de
mantenimiento que se corre a mano, una vez por entorno, y que es seguro volver a correr.

## Invocación

```bash
cd backend
pnpm db:backfill-token-balances            # aplica
pnpm db:backfill-token-balances --dry-run  # calcula y reporta, no escribe nada
```

Usa `DATABASE_URL` del entorno (igual que el resto de los scripts). `package.json` agrega
`"db:backfill-token-balances": "ts-node scripts/backfill-token-balances.ts"`.

## Precondiciones

- La migración de esquema del paso 1 aplicada (las columnas `balance_before`/`balance_after` existen).
- Recomendado: sin tráfico de órdenes durante la corrida (se protege cada tenencia con `FOR UPDATE`, pero el saldo de cierre se mueve si entran órdenes).
- **Nunca** contra una base que no sea la del entorno que se quiere completar; no se usa en tests contra la base de desarrollo (los tests usan Testcontainers).

## Comportamiento

Para cada tenencia (usuario, jugador) con asientos sin saldos (algoritmo en [research.md](../research.md) §5):

1. Transacción propia con `FOR UPDATE` sobre su fila de `token_holdings`.
2. Ordena los asientos pendientes (`created_at` ↑, CREDIT antes que DEBIT, `id` ↑).
3. Calcula `apertura = cierre − neto` y valida: `0`, o la cantidad emitida si el titular es el superusuario; sin saldos negativos.
4. Si valida: `UPDATE` sólo de las filas con ambos saldos en `NULL`. Si no: no escribe y registra la inconsistencia.

Garantías: no crea ni borra asientos, no cambia ningún otro campo, no sobrescribe valores existentes, y el resultado
no depende del orden en que se recorran las tenencias.

## Salida (stdout, una línea por tenencia + resumen)

```text
OK            user=<uuid> player=<uuid> asientos=<n> apertura=<0|100>
YA-COMPLETA   user=<uuid> player=<uuid>
INCONSISTENTE user=<uuid> player=<uuid> motivo=<opening-mismatch|negative-balance> apertura=<n> neto=<n> cierre=<n>
---
tenencias: <total>  aplicadas: <a>  ya completas: <c>  inconsistentes: <i>  asientos actualizados: <u>
```

Con `--dry-run` la primera columna es `OK(dry)` y `asientos actualizados` es 0.

## Código de salida

| Código | Significado |
|-------:|-------------|
| 0 | Todas las tenencias aplicadas o ya completas (el paso 2 puede evaluarse) |
| 1 | Hubo al menos una tenencia inconsistente (las demás sí se aplicaron); revisar el reporte |
| 2 | Error de ejecución (base inaccesible, esquema sin las columnas, etc.); no se aplicó nada nuevo en la tenencia en curso |

## Idempotencia

Volver a correrlo: las tenencias ya completas salen como `YA-COMPLETA`; las inconsistentes se vuelven a evaluar
(si se corrigieron los datos, se aplican). Dos corridas sobre los mismos datos producen el mismo resultado.

## Criterio para pasar al paso 2

El paso 2 (`NOT NULL`) sólo se entrega cuando, **en cada entorno**, la última corrida terminó con código 0 y
`SELECT count(*) FROM token_transactions WHERE balance_before IS NULL OR balance_after IS NULL` devuelve 0.
