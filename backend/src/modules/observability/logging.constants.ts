/** Configuración de logging inyectable (nivel y destino). Los tests la sobrescriben para capturar las líneas. */
export const LOG_CONFIG = Symbol('LOG_CONFIG');

/** Instancia raíz de pino compartida por el middleware temprano y por `LoggerModule`. */
export const LOG_ROOT_LOGGER = Symbol('LOG_ROOT_LOGGER');

export interface LogConfig {
  /** Nivel de pino: trace | debug | info | warn | error | fatal | silent. */
  level: string;
  /** Destino de escritura; si no se define se escribe en stdout. */
  stream?: { write(line: string): void };
}
