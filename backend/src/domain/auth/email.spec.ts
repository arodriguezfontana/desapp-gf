import { Email } from './email';
import { InvalidEmailError } from './errors/invalid-email.error';

describe('Email', () => {
  it('normaliza recortando espacios y pasando a minúsculas', () => {
    expect(Email.create('  Ana@Mail.com ').toString()).toBe('ana@mail.com');
  });

  it.each(['anamail.com', 'ana@', 'ana @mail.com', 'ana@mail', '', '   '])(
    'rechaza el formato inválido %p',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    },
  );

  it('acepta un dominio con subdominios (multi-nivel)', () => {
    expect(() => Email.create('user@sub.domain.com')).not.toThrow();
  });

  it('rechaza un dominio que arranca con punto justo después de la @', () => {
    expect(() => Email.create('a@.b.c')).toThrow(InvalidEmailError);
  });
});
