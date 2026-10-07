import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { Email } from '../../domain/auth/email';
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { UserRepository } from '../../repositories/auth/user.repository';
import { AdminSeedService } from './admin-seed.service';

describe('AdminSeedService', () => {
  const PASSWORD = 'Admin1234!';
  let users: jest.Mocked<UserRepository>;
  let hasher: jest.Mocked<PasswordHasher>;
  let env: Record<string, string | undefined>;
  let config: ConfigService;
  let service: AdminSeedService;
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;

  const withEnv = (email?: string, password?: string) => {
    env = { ADMIN_EMAIL: email, ADMIN_PASSWORD: password };
  };

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      existsByEmail: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('hash-admin'),
      compare: jest.fn(),
      timingSafeDummyHash: 'dummy',
    };
    withEnv('admin@mail.com', PASSWORD);
    config = { get: (key: string) => env[key] } as unknown as ConfigService;
    service = new AdminSeedService(users, hasher, config);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('omite el seed con aviso si falta ADMIN_EMAIL o ADMIN_PASSWORD', async () => {
    withEnv(undefined, PASSWORD);
    await service.run();
    expect(users.save).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('omite el seed con aviso si ADMIN_EMAIL tiene formato inválido, sin tocar el repositorio', async () => {
    withEnv('no-es-un-email', PASSWORD);
    await service.run();
    expect(users.existsByEmail).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('si el usuario ya existe, no crea otro, no hashea y no cambia nada', async () => {
    users.existsByEmail.mockResolvedValue(true);

    await service.run();

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Admin ya existe: sin cambios.');
  });

  it('si el usuario no existe, crea un admin con la contraseña hasheada', async () => {
    await service.run();

    expect(hasher.hash).toHaveBeenCalledWith(PASSWORD);
    expect(users.save).toHaveBeenCalledTimes(1);
    const saved = users.save.mock.calls[0][0] as User;
    expect(saved.email.toString()).toBe('admin@mail.com');
    expect(saved.passwordHash).toBe('hash-admin');
    expect(saved.role).toBe(UserRole.ADMIN);
  });

  it('si el save pierde una carrera por el email único, no lanza y lo registra como ya existente', async () => {
    users.save.mockRejectedValue(new EmailAlreadyInUseError());

    await expect(service.run()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('Admin ya existe: sin cambios.');
  });

  it('no crea nada si ADMIN_PASSWORD no cumple la política, y avisa sin revelar el valor', async () => {
    withEnv('admin@mail.com', 'corta');

    await service.run();

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
    const messages = warn.mock.calls.map((c) => String(c[0])).join(' ');
    expect(messages).not.toContain('corta');
  });

  it('ningún log contiene el valor de ADMIN_PASSWORD ni el correo', async () => {
    await service.run();

    const everything = [...warn.mock.calls, ...log.mock.calls]
      .map((c) => String(c[0]))
      .join(' ');
    expect(everything).not.toContain(PASSWORD);
    expect(everything).not.toContain('admin@mail.com');
  });

  it('el correo se normaliza igual que en el alta (trim + minúsculas)', async () => {
    withEnv('  Admin@Mail.COM ', PASSWORD);
    await service.run();
    expect(users.existsByEmail).toHaveBeenCalledWith(Email.create('admin@mail.com'));
  });
});
