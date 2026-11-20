import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUSINESS_OPERATIONS } from './business-metrics';

/**
 * Las series de `business_operations_total` se inicializan en 0 desde `BUSINESS_OPERATIONS`. Si alguien agrega un
 * `@AuditedOperation` nuevo y se olvida de la lista, su primera ocurrencia no se contaría: este test lo detecta.
 */
describe('BUSINESS_OPERATIONS', () => {
  const controllers = join(__dirname, '..', '..', '..', 'controllers');

  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
    });

  const declared = (): string[] =>
    sources(controllers).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/@AuditedOperation\(\s*'([A-Z_]+)'/g)].map((match) => match[1]),
    );

  it('contiene cada @AuditedOperation literal de los controllers', () => {
    const missing = declared().filter((operation) => !(BUSINESS_OPERATIONS as readonly string[]).includes(operation));
    expect(missing).toEqual([]);
  });

  it('contiene los nombres que resuelve POST /orders según el lado', () => {
    for (const name of ['TOKENS_BOUGHT', 'TOKENS_SOLD', 'ORDER_PLACED']) {
      expect(BUSINESS_OPERATIONS).toContain(name);
    }
  });

  it('no tiene repetidos ni nombres que ningún controller declare', () => {
    expect(new Set(BUSINESS_OPERATIONS).size).toBe(BUSINESS_OPERATIONS.length);
    const used = new Set([...declared(), 'TOKENS_BOUGHT', 'TOKENS_SOLD', 'ORDER_PLACED']);
    const unused = BUSINESS_OPERATIONS.filter((operation) => !used.has(operation));
    expect(unused).toEqual([]);
  });
});
