import { InvalidRoleError } from './errors/invalid-role.error';

/**
 * Enum de dominio (constitución, Principio II). Se persiste como texto en
 * `users.role` y `api_keys.role`; la validación vive acá, no en la base.
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

/** @throws InvalidRoleError si `value` no es un rol válido */
export function parseUserRole(value: string): UserRole {
  if (!Object.values(UserRole).includes(value as UserRole)) {
    throw new InvalidRoleError(value);
  }
  return value as UserRole;
}
