import { Email } from './email';
import { User } from './user';

describe('User', () => {
  const email = Email.create('ana@mail.com');
  const createdAt = new Date('2026-09-09T14:03:22.000Z');
  const user = User.register('id-1', email, 'hash-abc', createdAt);

  it('expone los datos con los que se registró', () => {
    expect(user.id).toBe('id-1');
    expect(user.email.equals(email)).toBe(true);
    expect(user.passwordHash).toBe('hash-abc');
    expect(user.createdAt).toBe(createdAt);
  });

  it('no expone la contraseña en claro por ningún accessor', () => {
    expect(JSON.stringify(user)).not.toContain('Abcd');
    expect(Object.values(user as unknown as Record<string, unknown>)).not.toContain(
      'plain-password',
    );
  });
});
