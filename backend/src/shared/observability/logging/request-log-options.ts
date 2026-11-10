import { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import type { Options } from 'pino-http';
import { CORRELATION_ID_HEADER, resolveCorrelationId } from './correlation-id';
import { RequestMetricsRecorder, toMetricSample } from '../metrics/request-metrics';
import { redactBody, redactQuery, redactUrl } from './redaction';

/** Máximo de caracteres del cuerpo de request que se registra; más allá se trunca (FR-014). */
export const MAX_LOGGED_BODY_LENGTH = 2048;

interface LoggableRequest {
  user?: { userId?: string };
  route?: { path?: string };
  params?: unknown;
  query?: unknown;
  body?: unknown;
}

function isEmptyBody(body: unknown): boolean {
  if (body === undefined || body === null || body === '') return true;
  return typeof body === 'object' && Object.keys(body as object).length === 0;
}

/** Cuerpo redactado y acotado: truncado si es muy grande, marcado si no se puede serializar. */
function loggedBody(body: unknown): unknown {
  const redacted = redactBody(body);
  let serialized: string;
  try {
    serialized = JSON.stringify(redacted);
  } catch {
    return { _unserializable: true };
  }
  if (serialized === undefined) return { _unserializable: true };
  if (serialized.length > MAX_LOGGED_BODY_LENGTH) {
    return { _truncated: true, preview: serialized.slice(0, MAX_LOGGED_BODY_LENGTH) };
  }
  return redacted;
}

/**
 * Campos que se agregan a la línea de cierre. Se calculan una sola vez, cuando la
 * respuesta ya terminó y los guards completaron `req.user` y Express resolvió
 * `route`/`params`. No se usa `customProps` porque `pino-http` lo evalúa al inicio y
 * al cierre y, si cambió el valor (usuario anónimo → autenticado), emite claves
 * duplicadas. Un fallo al armarlos nunca debe romper la request (FR-015).
 */
function buildRequestLogFields(req: LoggableRequest): Record<string, unknown> {
  try {
    const fields: Record<string, unknown> = {
      userId: req.user?.userId ?? 'anónimo',
    };
    if (req.route?.path !== undefined) fields.route = req.route.path;
    fields.params = redactBody(req.params ?? {});
    fields.query = redactQuery(req.query ?? {});
    if (!isEmptyBody(req.body)) fields.body = loggedBody(req.body);
    return fields;
  } catch {
    return {};
  }
}

/**
 * Registra la request terminada en las métricas (spec 029) con los mismos valores que el log:
 * `res.statusCode`, `req.route` y `responseTime`. Un fallo de las métricas nunca debe afectar la
 * respuesta ni el log (FR-013).
 */
function recordMetrics(
  recorder: RequestMetricsRecorder | undefined,
  req: IncomingMessage,
  res: ServerResponse,
  responseTimeMs: number,
): void {
  if (!recorder) return;
  try {
    recorder.record(toMetricSample(req, res, responseTimeMs));
  } catch {
    // Se ignora a propósito: la medición es secundaria respecto de la respuesta.
  }
}

/**
 * Opciones de `pino-http` para el log de cada request (spec 028). Se usan en dos
 * lugares: el middleware temprano que registra `configureRequestLogging` (el que
 * loguea) y `LoggerModule` (que sólo aporta el contexto por request, con
 * `autoLogging: false`).
 *
 * El serializador de `req` emite únicamente método y URL redactada: el estándar
 * volcaría todos los headers (`authorization`, `x-api-key`) y la URL con el token
 * del stream de notificaciones (constitución, Principio IV).
 *
 * Con `recorder` (spec 029), cada request terminada se cuenta y se mide en el mismo disparo que
 * emite su línea de cierre: así el total de las métricas coincide con el del log. Es opcional para
 * que el log siga funcionando sin métricas (tests unitarios).
 */
export function buildRequestLogOptions(logger: Logger, recorder?: RequestMetricsRecorder): Options {
  return {
    logger,
    // El child por request lleva sólo el id; si no, cada log del handler repetiría el objeto `req`.
    quietReqLogger: true,
    customAttributeKeys: { reqId: 'correlationId' },
    // Reutiliza el X-Correlation-Id entrante si es válido; si no, genera un UUID. El header
    // de respuesta se fija acá, antes de cualquier guard o parser posterior (FR-006/FR-009).
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const id = resolveCorrelationId(req.headers[CORRELATION_ID_HEADER.toLowerCase()]);
      res.setHeader(CORRELATION_ID_HEADER, id);
      return id;
    },
    serializers: {
      req: (req: { method: string; url: string }) => ({
        method: req.method,
        url: redactUrl(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    // IMPORTANTE (spec 029): las métricas se registran dentro de `customSuccessObject` y
    // `customErrorObject`. Si esta función devolviera `silent` para alguna request, `pino-http`
    // no evaluaría esos callbacks y esa ruta dejaría de medirse. Nunca devolver `silent` acá.
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessObject: (req, res, val) => {
      recordMetrics(recorder, req, res, val.responseTime);
      return { ...val, ...buildRequestLogFields(req as unknown as LoggableRequest) };
    },
    // Para los 5xx `pino-http` agrega un Error fabricado ("failed with status code 500") cuyo
    // stack no es el del fallo real: se descarta. El stack real lo loguea AllExceptionsFilter.
    customErrorObject: (req, res, _error, val) => {
      const { err: _fabricated, ...rest } = val as Record<string, unknown>;
      recordMetrics(recorder, req, res, (val as { responseTime: number }).responseTime);
      return { ...rest, ...buildRequestLogFields(req as unknown as LoggableRequest) };
    },
  };
}
