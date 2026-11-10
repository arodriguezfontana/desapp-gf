import { LogConfig } from '../../src/modules/logging/logging.constants';

export type LogLine = Record<string, unknown>;

export interface LogCapture {
  /** Configuración para sobrescribir `LOG_CONFIG` en `createTestApp`. */
  config: LogConfig;
  /** Todas las líneas capturadas, parseadas. Falla si alguna no es JSON válido (FR-005). */
  lines(): LogLine[];
  /** Texto completo capturado (para afirmar que un valor no aparece en ninguna parte). */
  raw(): string;
  /** Líneas de una misma request/operación. */
  byCorrelationId(id: string): LogLine[];
  clear(): void;
}

/** Sumidero de logs en memoria para los e2e de logging (nivel `info`). */
export function createLogCapture(): LogCapture {
  let captured: string[] = [];

  const lines = (): LogLine[] =>
    captured.map((line) => {
      try {
        return JSON.parse(line) as LogLine;
      } catch {
        throw new Error(`La línea de log no es JSON válido: ${line}`);
      }
    });

  return {
    config: {
      level: 'info',
      stream: {
        write(line: string) {
          captured.push(line);
        },
      },
    },
    lines,
    raw: () => captured.join(''),
    byCorrelationId: (id) => lines().filter((line) => line.correlationId === id),
    clear: () => {
      captured = [];
    },
  };
}
