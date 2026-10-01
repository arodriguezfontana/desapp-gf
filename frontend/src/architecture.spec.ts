import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

/**
 * Test de arquitectura del frontend (mismo espíritu que `backend/test/architecture.spec.ts`
 * con tsarch, constitución Principio I). Verifica automáticamente la regla de
 * Estructura para `frontend/src/`: "hooks/ y contexts/ — únicas capas que MUST
 * invocar service/". `components/`, `pages/` y `layout/` (el mismo alcance que
 * ya cubre el override de ESLint no-restricted-imports/no-restricted-globals de
 * R-007 para axios/fetch) nunca deben importar `service/` directamente — siempre
 * a través de un hook o un context.
 *
 * Antes reforzado sólo por convención (ver R-006/R-007 de 003-frontend-auth,
 * "el test de arquitectura (futuro) no tenga excepciones"): este archivo es
 * ese test.
 */

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const LAYERS_THAT_MUST_NOT_IMPORT_SERVICE = ['components', 'pages', 'layout'];

// Cubre imports relativos ('../service/...', '../../service/...') y el alias '@/service/...'.
const IMPORT_FROM_SERVICE =
  /(?:from\s+|require\(\s*|import\(\s*)['"](?:(?:\.\.\/)+service\/|@\/service\/)/;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    const isSourceFile = /\.(ts|tsx)$/.test(entry.name);
    const isSpecFile = /\.spec\.(ts|tsx)$/.test(entry.name);
    // Los tests SÍ pueden mockear service/ (constitución, Principio IX): sólo
    // se audita el código de producción.
    if (isSourceFile && !isSpecFile) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Arquitectura de capas del frontend (Constitución — Estructura)', () => {
  it.each(LAYERS_THAT_MUST_NOT_IMPORT_SERVICE)(
    '%s/ no importa service/ directamente — sólo hooks/ y contexts/ pueden hacerlo',
    (layer) => {
      const files = collectSourceFiles(join(SRC_DIR, layer));

      const offenders = files
        .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
        .filter(({ content }) => IMPORT_FROM_SERVICE.test(content))
        .map(({ file }) => relative(SRC_DIR, file));

      expect(offenders).toEqual([]);
    },
  );

  it('precondición: el patrón realmente detecta un import directo de service/ y no da falsos positivos', () => {
    expect(
      IMPORT_FROM_SERVICE.test(`import { authService } from '../service/authService';`),
    ).toBe(true);
    expect(
      IMPORT_FROM_SERVICE.test(`import { catalogService } from '../../service/catalogService';`),
    ).toBe(true);
    expect(
      IMPORT_FROM_SERVICE.test(`import { authService } from '@/service/authService';`),
    ).toBe(true);
    expect(
      IMPORT_FROM_SERVICE.test(`import { useAuthActions } from '../hooks/useAuthActions';`),
    ).toBe(false);
  });
});
