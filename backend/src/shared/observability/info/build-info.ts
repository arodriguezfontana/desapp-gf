import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Datos fijos del build que expone `GET /info`: no cambian mientras el proceso corre. */
export interface BuildInfo {
  name: string;
  version: string;
  /** Commit desplegado, si el despliegue lo informa en `GIT_COMMIT`; `null` si no. */
  commit: string | null;
  environment: string;
  node: string;
}

/** Lo mínimo que se lee del `package.json`. */
interface PackageManifest {
  name?: unknown;
  version?: unknown;
}

const UNKNOWN = 'unknown';

/** Texto no vacío o `null`; descarta valores de entorno con sólo espacios. */
const nonEmpty = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Arma la información del build a partir del entorno y del `package.json`. Es pura: el
 * manifiesto llega ya leído, así los tests no dependen del archivo real.
 *
 * Expone sólo datos no sensibles: nombre, versión, commit, entorno y versión de Node.
 * Ninguna variable de entorno se publica salvo `NODE_ENV` y `GIT_COMMIT`.
 */
export function resolveBuildInfo(
  env: NodeJS.ProcessEnv,
  manifest: PackageManifest | null,
  nodeVersion: string = process.version,
): BuildInfo {
  return {
    name: typeof manifest?.name === 'string' && manifest.name ? manifest.name : UNKNOWN,
    version: typeof manifest?.version === 'string' && manifest.version ? manifest.version : UNKNOWN,
    commit: nonEmpty(env.GIT_COMMIT),
    environment: nonEmpty(env.NODE_ENV) ?? 'development',
    node: nodeVersion,
  };
}

/**
 * Lee el `package.json` del directorio desde el que se lanzó el backend (`backend/`, tanto con
 * `pnpm dev` como con `pnpm start:prod`). Si no está o no es JSON válido devuelve `null` y la
 * versión queda como `unknown`: `/info` nunca debe impedir que la app arranque.
 */
export function readPackageManifest(cwd: string = process.cwd()): PackageManifest | null {
  try {
    return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as PackageManifest;
  } catch {
    return null;
  }
}
