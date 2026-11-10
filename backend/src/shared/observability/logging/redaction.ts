/** Marcador fijo con el que se reemplaza todo valor sensible; nunca se registra el original, ni parcial. */
export const REDACTED = '[REDACTED]';

/**
 * Claves cuyo valor no se loguea (constitución, Principio IV): contraseñas, JWT y
 * cualquier token, API keys, headers de autorización, credenciales y datos
 * personales (email y nombre de usuario). Se evalúa por nombre de clave, sin
 * distinguir mayúsculas.
 */
const SENSITIVE_KEY = /pass|token|secret|api.?key|authorization|credential|email|user.?name/i;

/** Tope de profundidad: corta estructuras muy anidadas o circulares. */
const MAX_DEPTH = 8;

const TRUNCATED = '[Truncated]';

/** Devuelve una copia del valor con los campos sensibles reemplazados, a cualquier profundidad. */
export function redactBody(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return TRUNCATED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactBody(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redactBody(item, depth + 1),
    ]),
  );
}

/** Mismo criterio que el cuerpo, aplicado a los parámetros de query ya parseados. */
export function redactQuery(query: unknown): unknown {
  return redactBody(query);
}

function isSensitiveParam(rawKey: string): boolean {
  let key = rawKey;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    // clave con codificación inválida: se evalúa tal cual
  }
  return SENSITIVE_KEY.test(key);
}

/**
 * Redacta los valores sensibles de la query de una URL (por ejemplo el `token` del
 * stream de notificaciones, que viaja en la URL porque EventSource no admite headers).
 */
export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) {
    return url;
  }
  const path = url.slice(0, queryStart);
  const query = url
    .slice(queryStart + 1)
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) return pair;
      const rawKey = pair.slice(0, eq);
      return isSensitiveParam(rawKey) ? `${rawKey}=${REDACTED}` : pair;
    })
    .join('&');
  return `${path}?${query}`;
}
