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
        e.source.includes('modules/auth/controller/') &&
        /node_modules\/@nestjs\//.test(e.target),
    );
    expect(controllerImportsNest).toBe(true);
  });

  it('el Controller no depende del Repository', async () => {
    const rule = project()
      .inFolder('modules/auth/controller')
      .shouldNot()
      .dependOnFiles()
      .inFolder('modules/auth/repository');
    await expect(rule).toPassAsync();
  });

  it('el Controller no depende de los Adapters', async () => {
    const rule = project()
      .inFolder('modules/auth/controller')
      .shouldNot()
      .dependOnFiles()
      .inFolder('modules/auth/adapters');
    await expect(rule).toPassAsync();
  });

  it('el Service no depende de la entidad de persistencia', async () => {
    const rule = project()
      .inFolder('modules/auth/service')
      .shouldNot()
      .dependOnFiles()
      .inFolder('modules/auth/repository/entities');
    await expect(rule).toPassAsync();
  });

  it('el Service no depende del mapper de persistencia', async () => {
    const rule = project()
      .inFolder('modules/auth/service')
      .shouldNot()
      .dependOnFiles()
      .inFolder('modules/auth/repository/mappers');
    await expect(rule).toPassAsync();
  });

  it('el dominio no depende de NestJS', async () => {
    const rule = project()
      .inFolder('modules/auth/domain')
      .shouldNot()
      .dependOnFiles()
      .matchingPattern('node_modules/@nestjs/');
    await expect(rule).toPassAsync();
  });

  it('el dominio no depende de TypeORM', async () => {
    const rule = project()
      .inFolder('modules/auth/domain')
      .shouldNot()
      .dependOnFiles()
      .matchingPattern('node_modules/(@nestjs/)?typeorm/');
    await expect(rule).toPassAsync();
  });
});
