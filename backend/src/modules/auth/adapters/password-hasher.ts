/**
 * Puerto de dominio para el hasheo de contraseñas. Mantiene al Service y al
 * dominio ignorantes de bcrypt. Token: PASSWORD_HASHER.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
  /**
   * Hash de descarte, valido para `compare`, usado en el login cuando el email
   * no existe: se corre un `compare` contra este valor para que el tiempo de
   * respuesta no delate si el email esta registrado (spec FR-012, defensa de
   * timing). Lo provee el Adapter para no dejar un literal con forma de secreto
   * en las capas superiores.
   */
  readonly timingSafeDummyHash: string;
}
