/**
 * Script CLI: completa el saldo anterior/posterior de los asientos de auditoría de tokens
 * anteriores a 030-token-balance-snapshot. Contrato: specs/030-token-balance-snapshot/contracts/backfill-cli.md
 *
 * Uso (desde backend/):
 *   pnpm db:backfill-token-balances            # aplica
 *   pnpm db:backfill-token-balances --dry-run  # calcula y reporta, no escribe nada
 *
 * Código de salida: 0 todo aplicado o ya completo; 1 hubo tenencias inconsistentes (las demás se
 * aplicaron); 2 error de ejecución.
 */
import 'dotenv/config';
import * as pg from 'pg';
import { DataSource } from 'typeorm';
import { backfillTokenBalances, BackfillHoldingDetail } from '../src/database/backfill/backfill-token-balances';

const line = (detail: BackfillHoldingDetail, dryRun: boolean): string => {
  const who = `user=${detail.userId} player=${detail.playerId}`;
  switch (detail.outcome) {
    case 'already-complete':
      return `YA-COMPLETA   ${who}`;
    case 'applied':
      return `${dryRun ? 'OK(dry)      ' : 'OK           '} ${who} asientos=${detail.entries} apertura=${detail.opening}`;
    case 'inconsistent':
      return `INCONSISTENTE ${who} motivo=${detail.reason} apertura=${detail.opening} neto=${detail.net} cierre=${detail.closingBalance}`;
  }
};

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL en el entorno.');
    return 2;
  }

  const dataSource = new DataSource({ type: 'postgres', url, driver: pg });
  try {
    await dataSource.initialize();
    const report = await backfillTokenBalances(dataSource, { dryRun });
    for (const detail of report.details) console.log(line(detail, dryRun));
    console.log('---');
    console.log(
      `tenencias: ${report.holdings}  aplicadas: ${report.applied}  ya completas: ${report.alreadyComplete}  ` +
        `inconsistentes: ${report.inconsistent.length}  asientos actualizados: ${report.updatedEntries}`,
    );
    return report.inconsistent.length > 0 ? 1 : 0;
  } catch (error) {
    console.error('Error durante el backfill:', error);
    return 2;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().then((code) => process.exit(code));
