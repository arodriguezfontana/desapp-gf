/**
 * Duracion del JWT. NO es un secreto (el secreto es JWT_SECRET, que vive en .env).
 * La spec fija la ventana en 24 horas (FR-011).
 */
export const JWT_EXPIRES_IN = '24h';

/** Misma duracion en segundos, para el campo `expiresIn` de la respuesta de login. */
export const JWT_EXPIRES_IN_SECONDS = 24 * 60 * 60;

/** Tokens de inyeccion de los puertos de dominio. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');
