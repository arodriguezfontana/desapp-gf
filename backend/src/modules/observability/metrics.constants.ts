/** Token del destino de las muestras de requests; el hook de logging lo resuelve con `app.get`. */
export const REQUEST_METRICS_RECORDER = Symbol('REQUEST_METRICS_RECORDER');

/** Token de inyección de `BusinessMetrics` (spec 031): lo provee y exporta `MetricsModule`; los services que miden el negocio lo inyectan. */
export const BUSINESS_METRICS = Symbol('BUSINESS_METRICS');
