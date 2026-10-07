/** Mensaje único para toda respuesta 401, tanto de `JwtAuthGuard` como de `ApiKeyGuard`. */
export const UNAUTHENTICATED_MESSAGE = 'No autenticado.';

/** 403 de `AdminApiKeyGuard`: la clave es válida pero su rol no alcanza. No revela qué rol se requiere. */
export const FORBIDDEN_ROLE_MESSAGE = 'No tiene permisos para realizar esta operación.';

/** 409 de `SyncInProgressError`: ya hay una corrida de sincronización en curso (spec 009, FR-015). */
export const SYNC_IN_PROGRESS_MESSAGE = 'Ya hay una sincronización en curso.';

/** 404 de `GET /sync/whoscored/:runId`: el runId no existe, fue descartado o se perdió al reiniciar el servidor (spec 009, FR-014). */
export const SYNC_RUN_NOT_FOUND_MESSAGE = 'La corrida de sincronización no existe o ya no está disponible.';
