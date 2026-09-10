import { AuthService } from './auth.service';
import { PasswordHasher } from '../adapters/password-hasher';
import { TokenIssuer } from '../adapters/token-issuer';
import { UserRepository } from '../repository/user.repository';
import { User } from '../domain/user';
import { Email } from '../domain/email';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error';
import { InvalidEmailError } from '../domain/errors/invalid-email.error';
import { InvalidPasswordError } from '../domain/errors/invalid-password.error';

describe('AuthService', () => {
  let users: jest.Mocked<UserRepository>;
  let hasher: jest.Mocked<PasswordHasher>;
  let tokens: jest.Mocked<TokenIssuer>;
  let service: AuthService;

  const existingUser = User.register(
    'id-1',
    Email.create('ana@mail.com'),
    'stored-hash',
    new Date(),
  );

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      existsByEmail: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
    };
    hasher = { hash: jest.fn(), compare: jest.fn(), timingSafeDummyHash: 'dummy-hash-para-test' };
    tokens = { issue: jest.fn(), verify: jest.fn() };
    service = new AuthService(users, hasher, tokens);
  });

  describe('register', () => {
    it('crea el usuario con la contraseña hasheada y no devuelve token', async () => {
      users.existsByEmail.mockResolvedValue(false);
      hasher.hash.mockResolvedValue('new-hash');

      const user = await service.register('Ana@Mail.com', 'Abcd1234!');

      expect(user.email.toString()).toBe('ana@mail.com');
      expect(user.passwordHash).toBe('new-hash');
      expect(users.save).toHaveBeenCalledWith(user);
      expect(tokens.issue).not.toHaveBeenCalled();
    });

    it('rechaza el email ya registrado', async () => {
      users.existsByEmail.mockResolvedValue(true);
      await expect(service.register('ana@mail.com', 'Abcd1234!')).rejects.toThrow(
        EmailAlreadyInUseError,
      );
      expect(users.save).not.toHaveBeenCalled();
    });

    it('rechaza el email mal formado antes de tocar el repositorio', async () => {
      await expect(service.register('no-es-email', 'Abcd1234!')).rejects.toThrow(
        InvalidEmailError,
      );
      expect(users.existsByEmail).not.toHaveBeenCalled();
    });

    it('rechaza la contraseña que incumple la política', async () => {
      await expect(service.register('ana@mail.com', 'weak')).rejects.toThrow(
        InvalidPasswordError,
      );
    });
  });

  describe('login', () => {
    it('devuelve un JWT cuando las credenciales son correctas', async () => {
      users.findByEmail.mockResolvedValue(existingUser);
      hasher.compare.mockResolvedValue(true);
      tokens.issue.mockReturnValue('jwt-123');

      await expect(service.login('ana@mail.com', 'Abcd1234!')).resolves.toBe(
        'jwt-123',
      );
      expect(tokens.issue).toHaveBeenCalledWith('id-1');
    });

    it('lanza InvalidCredentialsError si el email no existe (y compara contra un hash dummy)', async () => {
      users.findByEmail.mockResolvedValue(null);
      hasher.compare.mockResolvedValue(false);

      await expect(service.login('nadie@mail.com', 'Abcd1234!')).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(hasher.compare).toHaveBeenCalledTimes(1);
      expect(tokens.issue).not.toHaveBeenCalled();
    });

    it('lanza el MISMO InvalidCredentialsError si la contraseña no coincide', async () => {
      users.findByEmail.mockResolvedValue(existingUser);
      hasher.compare.mockResolvedValue(false);

      await expect(service.login('ana@mail.com', 'otra')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });
  });

  describe('getById', () => {
    it('devuelve el usuario', async () => {
      users.findById.mockResolvedValue(existingUser);
      await expect(service.getById('id-1')).resolves.toBe(existingUser);
    });

    it('lanza si el usuario ya no existe', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.getById('id-x')).rejects.toThrow(InvalidCredentialsError);
    });
  });
});
