import { Password } from './password';
import { InvalidPasswordError } from './errors/invalid-password.error';

describe('Password', () => {
  it('acepta una contraseña que cumple toda la política', () => {
    expect(Password.create('Abcd1234!').value()).toBe('Abcd1234!');
  });

  it.each([
    ['8 caracteres (límite inferior)', 'Abcd123!'],
    ['16 caracteres (límite superior)', 'Abcdefg12345678!'],
    ['espacio interior como carácter especial', 'Password 1'],
  ])('acepta: %s', (_desc, value) => {
    expect(() => Password.create(value)).not.toThrow();
  });

  it.each([
    ['7 caracteres', 'Abc123!'],
    ['17 caracteres', 'Abcdefg123456789!'],
    ['sin mayúscula', 'abcd1234!'],
    ['sin minúscula', 'ABCD1234!'],
    ['sin dígito', 'Abcdefgh!'],
    ['sin carácter especial', 'Abcd12345'],
  ])('rechaza: %s', (_desc, value) => {
    expect(() => Password.create(value)).toThrow(InvalidPasswordError);
  });
});
