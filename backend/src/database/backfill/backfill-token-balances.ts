import { DataSource } from 'typeorm';
import { SUPERUSER_USERNAME } from '../../domain/auth/superuser';
import { ChainMovement, orderForChain, reconstructHoldingChain } from '../../domain/orders/balance-chain';
import { TokenTransactionType } from '../../domain/orders/enums/token-transaction-type';

/**
 * Backfill de saldos de los asientos de auditoría anteriores a 030-token-balance-snapshot.
 * Completa `balance_before`/`balance_after` tenencia por tenencia, validando contra el saldo real.
 * Contrato y reglas: specs/030-token-balance-snapshot/contracts/backfill-cli.md y research.md §5.
 *
 * Es infraestructura de mantenimiento (SQL crudo sobre un `DataSource`), no parte del camino de
 * requests; el cálculo vive en el dominio (`reconstructHoldingChain`). Principio V: el único
 * `UPDATE` que hace pasa un campo de NULL a un valor (`WHERE … IS NULL`); nunca sobrescribe, ni
 * crea ni borra asientos.
 */

export interface BackfillOptions {
  /** Calcula y reporta, sin escribir nada. */
  dryRun?: boolean;
}

export interface BackfillInconsistency {
  userId: string;
  playerId: string;
  reason: 'opening-mismatch' | 'negative-balance';
  opening: number;
  net: number;
  closingBalance: number;
}

export type BackfillHoldingDetail =
  | { userId: string; playerId: string; outcome: 'already-complete' }
  | { userId: string; playerId: string; outcome: 'applied'; entries: number; opening: number; dryRun: boolean }
  | ({ outcome: 'inconsistent' } & BackfillInconsistency);

export interface BackfillReport {
  /** Tenencias (usuario, jugador) con al menos un asiento. */
  holdings: number;
  applied: number;
  alreadyComplete: number;
  inconsistent: BackfillInconsistency[];
  /** Asientos efectivamente actualizados (0 en `dryRun`). */
  updatedEntries: number;
  details: BackfillHoldingDetail[];
}

interface EntryRow {
  id: string;
  type: TokenTransactionType;
  quantity: number;
  created_at: Date;
  balance_before: number | null;
  balance_after: number | null;
}

const isPending = (row: EntryRow): boolean => row.balance_before === null && row.balance_after === null;
const isComplete = (row: EntryRow): boolean => row.balance_before !== null && row.balance_after !== null;

/**
 * Filas afectadas por un `UPDATE … RETURNING`: según la versión de TypeORM, `query` devuelve las
 * filas o el par `[filas, cantidad]`.
 */
function affectedRows(raw: unknown): number {
  if (Array.isArray(raw) && Array.isArray(raw[0])) return (raw[0] as unknown[]).length;
  return Array.isArray(raw) ? raw.length : 0;
}

const toMovement = (row: EntryRow): ChainMovement => ({
  id: row.id,
  type: row.type,
  quantity: row.quantity,
  createdAt: row.created_at,
});

export async function backfillTokenBalances(
  dataSource: DataSource,
  options: BackfillOptions = {},
): Promise<BackfillReport> {
  const dryRun = options.dryRun ?? false;
  const groups: Array<{ user_id: string; player_id: string; has_pending: boolean }> = await dataSource.query(
    `SELECT user_id, player_id,
            bool_or(balance_before IS NULL AND balance_after IS NULL) AS has_pending
       FROM "token_transactions"
      GROUP BY user_id, player_id
      ORDER BY user_id, player_id`,
  );

  const report: BackfillReport = {
    holdings: groups.length,
    applied: 0,
    alreadyComplete: 0,
    inconsistent: [],
    updatedEntries: 0,
    details: [],
  };

  for (const group of groups) {
    const userId = group.user_id;
    const playerId = group.player_id;
    if (!group.has_pending) {
      report.alreadyComplete += 1;
      report.details.push({ userId, playerId, outcome: 'already-complete' });
      continue;
    }

    // Una transacción por tenencia: se confirma sólo si la reconstrucción valida.
    await dataSource.transaction(async (manager) => {
      // Mismo lock que toma la ejecución de órdenes: el saldo de cierre no se mueve mientras tanto.
      const holdingRows: Array<{ quantity: number }> = await manager.query(
        `SELECT quantity FROM "token_holdings" WHERE user_id = $1 AND player_id = $2 FOR UPDATE`,
        [userId, playerId],
      );
      const currentQuantity = holdingRows[0]?.quantity ?? 0;

      const entries: EntryRow[] = await manager.query(
        `SELECT id, type, quantity, created_at, balance_before, balance_after
           FROM "token_transactions" WHERE user_id = $1 AND player_id = $2`,
        [userId, playerId],
      );
      const pending = entries.filter(isPending);
      const completed = entries.filter(isComplete);

      // Los asientos ya completos (los escribe el código nuevo) son siempre posteriores a los
      // históricos: el saldo de cierre de los pendientes es el `balance_before` del primero de ellos.
      const firstCompleted = orderForChain(completed.map(toMovement))[0];
      const closingBalance = firstCompleted
        ? (completed.find((row) => row.id === firstCompleted.id)!.balance_before as number)
        : currentQuantity;

      const userRows: Array<{ username: string }> = await manager.query(
        `SELECT username FROM "users" WHERE id = $1`,
        [userId],
      );
      const isSuperuser = userRows[0]?.username === SUPERUSER_USERNAME;

      const result = reconstructHoldingChain({ pending: pending.map(toMovement), closingBalance, isSuperuser });

      if (result.status === 'inconsistent') {
        const inconsistency: BackfillInconsistency = {
          userId,
          playerId,
          reason: result.reason,
          opening: result.opening,
          net: result.net,
          closingBalance: result.closingBalance,
        };
        report.inconsistent.push(inconsistency);
        report.details.push({ outcome: 'inconsistent', ...inconsistency });
        return;
      }

      let updated = 0;
      if (!dryRun) {
        for (const [id, snapshot] of result.snapshots) {
          // Sólo NULL → valor: jamás pisa un saldo ya escrito.
          const raw: unknown = await manager.query(
            `UPDATE "token_transactions" SET balance_before = $1, balance_after = $2
              WHERE id = $3 AND balance_before IS NULL AND balance_after IS NULL RETURNING id`,
            [snapshot.before, snapshot.after, id],
          );
          updated += affectedRows(raw);
        }
      }
      report.applied += 1;
      report.updatedEntries += updated;
      report.details.push({
        userId,
        playerId,
        outcome: 'applied',
        entries: pending.length,
        opening: result.opening,
        dryRun,
      });
    });
  }

  return report;
}
