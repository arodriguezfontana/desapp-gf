/**
 * Puerto de dominio para emitir y verificar el JWT de sesion. Token: TOKEN_ISSUER.
 */
export interface TokenIssuer {
  /** Emite un JWT que identifica al usuario (claim `sub`). */
  issue(userId: string): string;
  /**
   * Verifica firma y vencimiento. Devuelve el userId del `sub`.
   * Lanza si el token es invalido, esta manipulado o vencido.
   */
  verify(token: string): { userId: string };
}
