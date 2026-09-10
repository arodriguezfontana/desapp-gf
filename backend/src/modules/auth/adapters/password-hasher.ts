/**
 * Puerto de dominio para el hasheo de contraseñas. Mantiene al Service y al
 * dominio ignorantes de bcrypt. Token: PASSWORD_HASHER.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
