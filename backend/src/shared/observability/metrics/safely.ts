/**
 * Medir nunca altera el resultado de la operación medida (spec 031, FR-013): cualquier fallo de una medición se
 * ignora. Es el único lugar donde se traga el error; los services lo usan en vez de repetir `try/catch`.
 */
export function safely(work: () => void): void {
  try {
    work();
  } catch {
    // Ignorado a propósito: una medición fallida no debe llegar a la operación medida.
  }
}

/** Versión asíncrona de `safely`: espera la medición y se traga cualquier fallo, síncrono o de la promesa. */
export async function safelyAsync(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch {
    // Ignorado a propósito: una medición fallida no debe llegar a la operación medida.
  }
}
