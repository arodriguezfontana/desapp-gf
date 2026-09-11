import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from '../auth.constants';
import { PasswordHasher } from '../adapters/password-hasher';
import { TokenIssuer } from '../adapters/token-issuer';
import { Email } from '../domain/email';
import { Password } from '../domain/password';
import { User } from '../domain/user';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  /**
   * Alta de cuenta. No inicia sesion ni devuelve token (spec FR-006).
   * @throws InvalidEmailError | InvalidPasswordError | EmailAlreadyInUseError
   */
  async register(rawEmail: string, rawPassword: string): Promise<User> {
    const email = Email.create(rawEmail);
    const password = Password.create(rawPassword);

    if (await this.users.existsByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }

    const passwordHash = await this.hasher.hash(password.value());
    const user = User.register(randomUUID(), email, passwordHash, new Date());
    await this.users.save(user);
    return user;
  }

  /**
   * Login. Devuelve un JWT si las credenciales son correctas. Email inexistente
   * y contraseña incorrecta producen el mismo error (spec FR-012), con una
   * comparacion dummy para no delatar por timing.
   * @throws InvalidCredentialsError
   */
  async login(rawEmail: string, rawPassword: string): Promise<string> {
    const email = Email.create(rawEmail);
    const user = await this.users.findByEmail(email);

    if (!user) {
      await this.hasher.compare(rawPassword, this.hasher.timingSafeDummyHash);
      throw new InvalidCredentialsError();
    }

    const matches = await this.hasher.compare(rawPassword, user.passwordHash);
    if (!matches) {
      throw new InvalidCredentialsError();
    }

    return this.tokens.issue(user.id);
  }

  /**
   * Devuelve el usuario autenticado. El JwtAuthGuard ya garantizo que existe;
   * si aun asi no aparece, se trata como no autenticado.
   * @throws InvalidCredentialsError
   */
  async getById(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    return user;
  }
}
