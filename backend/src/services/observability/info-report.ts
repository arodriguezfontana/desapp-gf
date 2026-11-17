/**
 * Información del servicio que devuelve `InfoService`. Es el resultado de la capa de Service; el
 * Controller lo expone con `InfoResponseDto`, que lo implementa. El Service no importa el DTO.
 */
export interface InfoReport {
  /** Nombre del servicio, tomado del package.json. */
  name: string;
  /** Versión del package.json; "unknown" si no se pudo leer. */
  version: string;
  /** Commit desplegado (variable GIT_COMMIT); null si no se informó. */
  commit: string | null;
  /** Valor de NODE_ENV; "development" si no está definido. */
  environment: string;
  /** Versión de Node.js del proceso. */
  node: string;
  /** Momento en que arrancó el proceso (ISO 8601, UTC). */
  startedAt: string;
  /** Segundos transcurridos desde el arranque (enteros). */
  uptimeSeconds: number;
}
