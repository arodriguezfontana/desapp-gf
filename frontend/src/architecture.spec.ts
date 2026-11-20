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

/**
 * Sentido único de dependencias dentro de `frontend/src/` (constitución, Principio I — Frontend):
 *
 *   components / pages / layout  →  hooks / contexts  →  service
 *
 * Las capas de abajo nunca conocen a las de arriba, y `utils/` y `types/` no dependen de ninguna otra
 * capa. Es el complemento de la regla de arriba ("sólo hooks/ y contexts/ importan service/").
 */
function importsFromLayer(layer: string): RegExp {
  // Cubre imports relativos ('../hooks/...', '../../hooks/...') y el alias '@/hooks/...'.
  return new RegExp(`(?:from\\s+|require\\(\\s*|import\\(\\s*)['"](?:(?:\\.\\./)+|@/)${layer}/`);
}

const UPWARD_DEPENDENCIES: Array<{ layer: string; mustNotImport: string[] }> = [
  { layer: 'service', mustNotImport: ['hooks', 'contexts', 'components', 'pages', 'layout'] },
  { layer: 'hooks', mustNotImport: ['components', 'pages', 'layout'] },
  { layer: 'contexts', mustNotImport: ['components', 'pages', 'layout'] },
  { layer: 'utils', mustNotImport: ['service', 'hooks', 'contexts', 'components', 'pages', 'layout'] },
  { layer: 'types', mustNotImport: ['service', 'hooks', 'contexts', 'components', 'pages', 'layout'] },
];

describe('Arquitectura de capas del frontend — sin dependencias hacia arriba', () => {
  it.each(UPWARD_DEPENDENCIES)(
    '$layer/ no importa $mustNotImport',
    ({ layer, mustNotImport }) => {
      const files = collectSourceFiles(join(SRC_DIR, layer));

      const offenders = files.flatMap((file) => {
        const content = readFileSync(file, 'utf-8');
        return mustNotImport
          .filter((forbidden) => importsFromLayer(forbidden).test(content))
          .map((forbidden) => `${relative(SRC_DIR, file)} importa ${forbidden}/`);
      });

      expect(offenders).toEqual([]);
    },
  );

  it.each(UPWARD_DEPENDENCIES.map(({ layer }) => layer))(
    'precondición: %s/ existe y tiene código de producción (la regla no pasa en falso por una carpeta vacía)',
    (layer) => {
      expect(collectSourceFiles(join(SRC_DIR, layer)).length).toBeGreaterThan(0);
    },
  );

  it('precondición: el patrón detecta un import hacia arriba y no da falsos positivos', () => {
    expect(importsFromLayer('hooks').test(`import { useAuth } from '../hooks/useAuth';`)).toBe(true);
    expect(importsFromLayer('hooks').test(`import { useAuth } from '../../hooks/useAuth';`)).toBe(true);
    expect(importsFromLayer('components').test(`import { Button } from '@/components/Button';`)).toBe(true);
    expect(importsFromLayer('components').test(`import { authService } from '../service/authService';`)).toBe(false);
    expect(importsFromLayer('hooks').test(`import { useX } from './useX';`)).toBe(false);
  });
});
