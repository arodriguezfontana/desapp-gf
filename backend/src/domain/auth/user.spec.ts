import { Email } from './email';
import { InvalidRoleError } from './errors/invalid-role.error';
import { User } from './user';
import { UserRole } from './user-role';

describe('User', () => {
  const email = Email.create('ana@mail.com');
  const createdAt = new Date('2026-09-09T14:03:22.000Z');
  const user = User.register('id-1', email, 'hash-abc', createdAt);

  it('expone los datos con los que se registró', () => {
    expect(user.id).toBe('id-1');
    expect(user.email).toBe(email);
    expect(user.passwordHash).toBe('hash-abc');
    expect(user.createdAt).toBe(createdAt);
  });

  it('no expone la contraseña en claro por ningún accessor', () => {
    expect(JSON.stringify(user)).not.toContain('Abcd');
    expect(Object.values(user as unknown as Record<string, unknown>)).not.toContain(
      'plain-password',
    );
  });

  describe('role', () => {
    it('es user por default cuando no se indica rol', () => {
      expect(user.role).toBe(UserRole.USER);
    });

    it('acepta admin explícito', () => {
      const admin = User.register('id-2', email, 'hash', createdAt, UserRole.ADMIN);
      expect(admin.role).toBe(UserRole.ADMIN);
    });

    it('rechaza un rol inválido con InvalidRoleError', () => {
      expect(() =>
        User.register('id-3', email, 'hash', createdAt, 'superadmin' as UserRole),
      ).toThrow(InvalidRoleError);
    });
  });
});
