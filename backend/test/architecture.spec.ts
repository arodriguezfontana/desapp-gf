import { createRequire } from 'node:module';
import 'tsarch/dist/jest';
import { filesOfProject } from 'tsarch';

/**
 * Workaround de un bug de `@zerollup/ts-helpers` (dependencia transitiva de tsarch,
 * clavada a TypeScript 3.9). Ante un import de paquete npm que no coincide con
 * ningún alias de `compilerOptions.paths`, `getImportSuggestions()` devuelve una
 * ruta relativa inventada en lugar de `undefined`; tsarch confía en esa "sugerencia",
 * `ts.resolveModuleName` falla y el edge hacia `node_modules` se pierde. Resultado:
 * las reglas "X no depende del paquete Y" nunca disparaban.
 *
 * Este proyecto no usa `paths`, así que la sugerencia correcta siempre es `undefined`:
 * forzamos ese valor y tsarch pasa a resolver el especificador real (relativo o npm).
 */
const nodeRequire = createRequire(__filename);
const zerollup = nodeRequire(
  nodeRequire.resolve('@zerollup/ts-helpers', {
    paths: [nodeRequire.resolve('tsarch')],
  }),
) as { ImportPathsResolver: { prototype: Record<string, unknown> } };
zerollup.ImportPathsResolver.prototype.getImportSuggestions = () => undefined;

/**
 * Test de arquitectura (constitución, Principio IX). Verifica automáticamente las
 * reglas de capas del Principio I y falla el build como cualquier otro test.
 *
 * Sentido único: Controller → Service → {Dominio, Repository, Adapter}.
 *
 * `backend/src/` se organiza por capa (controllers/, services/, domain/,
 * repositories/, adapters/, guards/); dentro de cada capa hay una subcarpeta por
 * feature (auth/, api-key/, player/, player-sync/, competition/), pero eso es solo
 * para navegar más fácil — cada regla de acá sigue usando un glob por capa que
 * cubre a todas las features de una sola vez, sin importar esa subdivisión interna.
 */
const ARCH_TSCONFIG = 'tsconfig.arch.json';

interface GraphEdge {
  source: string;
  target: string;
  external: boolean;
}

describe('Arquitectura en capas (Principio I)', () => {
  jest.setTimeout(60_000);

  const project = () => filesOfProject(ARCH_TSCONFIG);

  /**
   * Canario. Las dos reglas "el dominio no depende de NestJS/TypeORM" comparan
   * contra edges hacia `node_modules`, y sólo tienen valor si tsarch está
   * resolviendo esos imports (ver el workaround de arriba). Si este edge conocido
   * —el Controller SÍ importa `@nestjs/*`— desaparece, la extracción de
   * dependencias externas se rompió y las reglas de dominio pasarían en falso.
   */
  it('precondición: tsarch resuelve los imports a paquetes npm', async () => {
    const { extractGraph } = nodeRequire(
      'tsarch/dist/src/common/extraction/extractGraph',
    ) as { extractGraph: (cfg: string) => Promise<GraphEdge[]> };
    const graph = await extractGraph(ARCH_TSCONFIG);

    const externalFromSrc = graph.filter(
      (e) => e.source.startsWith('src/') && e.external,
    );
    expect(externalFromSrc.length).toBeGreaterThan(0);

    const controllerImportsNest = graph.some(
      (e) =>
        e.source.includes('controllers/') &&
        /node_modules\/@nestjs\//.test(e.target),
    );
    expect(controllerImportsNest).toBe(true);
  });

  it('el Controller no depende del Repository', async () => {
    const rule = project()
      .inFolder('controllers')
      .shouldNot()
      .dependOnFiles()
      .inFolder('repositories');
    await expect(rule).toPassAsync();
  });

  it('el Controller no depende de los Adapters', async () => {
    const rule = project()
      .inFolder('controllers')
      .shouldNot()
      .dependOnFiles()
      .inFolder('adapters');
    await expect(rule).toPassAsync();
  });

  it('el Service no depende de la entidad de persistencia', async () => {
    const rule = project()
      .inFolder('services')
      .shouldNot()
      .dependOnFiles()
      .matchingPattern('repositories/.*/entities/');
    await expect(rule).toPassAsync();
  });

  it('el Service no depende del mapper de persistencia', async () => {
    const rule = project()
      .inFolder('services')
      .shouldNot()
      .dependOnFiles()
      .matchingPattern('repositories/.*/mappers/');
    await expect(rule).toPassAsync();
  });

  it.each([
    {
      title: 'el dominio no depende de NestJS',
      folder: 'domain',
      pattern: 'node_modules/@nestjs/',
    },
    {
      title: 'el dominio no depende de TypeORM',
      folder: 'domain',
      pattern: 'node_modules/(@nestjs/)?typeorm/',
    },
    {
      // `import ... from 'bcrypt'` resuelve a @types/bcrypt (el paquete no trae
      // sus propios .d.ts), asi que el patron cubre ambas formas.
      title:
        'el Service no debe importar librerías de infraestructura directo (hasheo, etc.), eso vive detrás del Adapter correspondiente',
      folder: 'services',
      pattern: 'node_modules/(@types/)?bcrypt/',
    },
    {
      title:
        'el Service no debe importar la librería de scraping directo (got-scraping/cheerio), eso vive detrás de WhoScoredAdapter (006-whoscored-catalog-sync)',
      folder: 'services',
      pattern: 'node_modules/(got-scraping|cheerio)/',
    },
  ])('$title', async ({ folder, pattern }) => {
    const rule = project()
      .inFolder(folder)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(pattern);
    await expect(rule).toPassAsync();
  });
});
