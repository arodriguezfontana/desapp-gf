import { createHash } from 'node:crypto';

export interface CacheKeyOptions {
  prefix?: string;
}

/**
 * Serializa de forma determinista y canónica un objeto de parámetros de consulta:
 * 1. Filtra valores nulos, indefinidos o vacíos.
 * 2. Aplica trim a las cadenas.
 * 3. Ordena las claves alfabéticamente.
 * 4. Genera un hash SHA-256 de los primeros 16 caracteres hexadecimales.
 */
export function hashParams(params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => {
      const val = params[k];
      return val !== undefined && val !== null && val !== '';
    })
    .sort();

  if (sortedKeys.length === 0) {
    return 'default';
  }

  const normalizedPairs = sortedKeys.map((k) => {
    const val = params[k];
    const stringVal = typeof val === 'string' ? val.trim() : String(val);
    return `${k}=${stringVal}`;
  });

  const canonicalString = normalizedPairs.join('&');
  return createHash('sha256').update(canonicalString).digest('hex').slice(0, 16);
}

/**
 * Construye una clave canónica de caché con el prefijo global del sistema:
 * `futval:<namespace>:<hash>`
 */
export function buildCacheKey(
  namespace: string,
  params: Record<string, unknown>,
  options: CacheKeyOptions = {},
): string {
  const prefix = options.prefix ?? 'futval';
  const hash = hashParams(params);
  return `${prefix}:${namespace}:${hash}`;
}

/**
 * Clave canónica aislada por usuario para el ranking de cotizaciones:
 * `futval:ranking:<userId>:<hash>`
 */
export function buildUserRankingCacheKey(
  userId: string,
  params: Record<string, unknown>,
  options: CacheKeyOptions = {},
): string {
  const prefix = options.prefix ?? 'futval';
  const hash = hashParams(params);
  return `${prefix}:ranking:${userId}:${hash}`;
}
