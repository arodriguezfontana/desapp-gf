export const API_KEY_REPOSITORY = Symbol('API_KEY_REPOSITORY');
export const TOKEN_HASHER = Symbol('TOKEN_HASHER');

export const API_KEY_PREFIX = 'pmk_';
export const API_KEY_RANDOM_BYTES = 32;

/** Header HTTP donde se espera la ApiKey en texto plano (guards que la consumen). */
export const API_KEY_HEADER = 'x-api-key';

