/**
 * Puerto de dominio para el hasheo de ApiKeys. Mantiene al Service y al dominio
 * ignorantes de la implementación criptográfica concreta (node:crypto / SHA-256).
 * Token: TOKEN_HASHER.
 */
export interface TokenHasher {
  hash(token: string): string;
  compare(token: string, hash: string): boolean;
}

