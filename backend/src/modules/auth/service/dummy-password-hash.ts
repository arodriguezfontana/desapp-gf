/**
 * Hash bcrypt fijo (de la cadena "dummy-password", cost 10). Se usa en el login
 * cuando el email no existe: se corre igual un bcrypt.compare contra este valor
 * para que el tiempo de respuesta no delate si el email esta registrado
 * (spec FR-012, defensa de timing).
 */
// Hash bcrypt fijo e intencional para la defensa de timing en el login (spec FR-012):
// no es una credencial real, es un valor público sin cuenta asociada y no admite un fix
// de código. Se suprime el finding de "hardcoded secret" de Sonar.
export const TIMING_SAFE_DUMMY_HASH =
  '$2b$10$rUT3r5qX1hIp6w53TSVUN.ulqAaqwWyEHoTSCIzeB8/G2zEohNvr6'; // NOSONAR
