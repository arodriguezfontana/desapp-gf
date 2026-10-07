/** Mensaje único para toda respuesta 401, tanto de `JwtAuthGuard` como de `ApiKeyGuard`. */
export const UNAUTHENTICATED_MESSAGE = 'No autenticado.';

/** 403 de `AdminApiKeyGuard`: la clave es válida pero su rol no alcanza. No revela qué rol se requiere. */
export const FORBIDDEN_ROLE_MESSAGE = 'No tiene permisos para realizar esta operación.';
