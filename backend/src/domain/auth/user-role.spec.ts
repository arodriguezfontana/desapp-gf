import { InvalidRoleError } from './errors/invalid-role.error';
import { parseUserRole, UserRole } from './user-role';

describe('parseUserRole', () => {
  it.each(['admin', 'user'])('acepta %s', (value) => {
    expect(parseUserRole(value)).toBe(value);
  });

  it.each(['superadmin', '', 'Admin', 'USER', undefined as unknown as string])(
    'rechaza %p con InvalidRoleError',
    (value) => {
      expect(() => parseUserRole(value)).toThrow(InvalidRoleError);
    },
  );

  it('expone exactamente admin y user', () => {
    expect(Object.values(UserRole).sort()).toEqual(['admin', 'user']);
  });
});
