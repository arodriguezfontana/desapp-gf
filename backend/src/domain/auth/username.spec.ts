import { Username } from './username';
import { ReservedUsernameError } from './errors/reserved-username.error';

describe('Username', () => {
  it('rechaza exactamente "superuser" con ReservedUsernameError', () => {
    expect(() => Username.create('superuser')).toThrow(ReservedUsernameError);
  });

  it('rechaza "superuser" con espacios alrededor (normaliza con trim)', () => {
    expect(() => Username.create('  superuser  ')).toThrow(ReservedUsernameError);
  });

  it('acepta cualquier otro valor, incluso parecido', () => {
    expect(Username.create('inversor').value()).toBe('inversor');
    expect(Username.create('superusers').value()).toBe('superusers');
    expect(Username.create('super user').value()).toBe('super user');
  });

  it('no hace case-insensitive el valor reservado (spec: solo el string exacto)', () => {
    expect(Username.create('Superuser').value()).toBe('Superuser');
    expect(Username.create('SUPERUSER').value()).toBe('SUPERUSER');
  });

  it('permite que dos usuarios distintos compartan el mismo username no reservado', () => {
    expect(Username.create('inversor').value()).toBe(Username.create('inversor').value());
  });
});
