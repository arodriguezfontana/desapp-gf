import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { getSlaClass, SlaClassName } from '../../../src/shared/observability/metrics/sla';

/** Identificador de un endpoint: `"MÉTODO /patrón"` (el mismo texto que forman las etiquetas `method` y `route`). */
export type EndpointId = string;

interface ExpressLayer {
  route?: { path: unknown; methods: Record<string, boolean> };
}

/**
 * Endpoints que el router de Express publica realmente. Excluye las capas comodín (`{/*splat}`),
 * que son las de los middleware de Nest y no endpoints de controller.
 */
export function listRouterRoutes(app: INestApplication): EndpointId[] {
  const router = (app.getHttpAdapter().getInstance() as { router: { stack: ExpressLayer[] } }).router;
  const ids: EndpointId[] = [];
  for (const layer of router.stack) {
    const route = layer.route;
    if (!route || typeof route.path !== 'string' || route.path.includes('*')) continue;
    for (const [method, enabled] of Object.entries(route.methods)) {
      if (enabled && !method.startsWith('_')) ids.push(`${method.toUpperCase()} ${route.path}`);
    }
  }
  return ids.sort();
}

const joinPaths = (...parts: string[]): string => {
  const joined = '/' + parts.filter((part) => part !== '' && part !== '/').join('/');
  const collapsed = joined.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed;
};

const asPath = (value: unknown): string => (Array.isArray(value) ? String(value[0] ?? '') : String(value ?? ''));

/**
 * Endpoints que declaran `@Sla`, leídos de los controllers registrados (ModulesContainer) con los
 * mismos metadatos de ruta que usa Nest. Un handler repetido o sin `@Sla` no aparece / aparece dos veces.
 */
export function listDeclaredSla(app: INestApplication): { id: EndpointId; sla: SlaClassName }[] {
  const container = app.get(ModulesContainer, { strict: false });
  const declared: { id: EndpointId; sla: SlaClassName }[] = [];
  for (const module of container.values()) {
    for (const wrapper of module.controllers.values()) {
      const controllerClass = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!controllerClass) continue;
      const controllerPath = asPath(Reflect.getMetadata(PATH_METADATA, controllerClass));
      for (const name of Object.getOwnPropertyNames(controllerClass.prototype)) {
        const handler = (controllerClass.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        const sla = getSlaClass(handler);
        if (method === undefined || sla === undefined) continue;
        const methodPath = asPath(Reflect.getMetadata(PATH_METADATA, handler));
        declared.push({ id: `${RequestMethod[method]} ${joinPaths(controllerPath, methodPath)}`, sla });
      }
    }
  }
  return declared.sort((a, b) => a.id.localeCompare(b.id));
}

export interface CoverageDiff {
  /** Endpoints publicados sin entrada de SLA. */
  missingSla: EndpointId[];
  /** Entradas de SLA sin endpoint publicado. */
  orphanSla: EndpointId[];
  /** Endpoints con más de una entrada de SLA. */
  duplicateSla: EndpointId[];
}

/** Compara los endpoints publicados contra los que declaran SLA. */
export function compareRouteSets(published: EndpointId[], declared: EndpointId[]): CoverageDiff {
  const publishedSet = new Set(published);
  const declaredSet = new Set(declared);
  const seen = new Set<EndpointId>();
  const duplicateSla = new Set<EndpointId>();
  for (const id of declared) {
    if (seen.has(id)) duplicateSla.add(id);
    seen.add(id);
  }
  return {
    missingSla: [...publishedSet].filter((id) => !declaredSet.has(id)).sort(),
    orphanSla: [...declaredSet].filter((id) => !publishedSet.has(id)).sort(),
    duplicateSla: [...duplicateSla].sort(),
  };
}
