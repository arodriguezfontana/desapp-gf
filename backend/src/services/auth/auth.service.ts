import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { CLOCK, ID_GENERATOR } from '../../modules/runtime/runtime.constants';

import {
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from '../../modules/auth/auth.constants';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { TokenIssuer } from '../../adapters/auth/token-issuer';
import { Email } from '../../domain/auth/email';
import { Password } from '../../domain/auth/password';
import { Username } from '../../domain/auth/username';
import { User } from '../../domain/auth/user';
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../domain/auth/errors/invalid-credentials.error';
import { UserRepository } from '../../repositories/auth/user.repository';
import { UserStrategyProvisioningService } from '../quotation/user-strategy-provisioning.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    private readonly strategyProvisioning: UserStrategyProvisioningService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Alta de cuenta. No inicia sesion ni devuelve token (spec FR-006).
   * Al crear el usuario, le provisiona automáticamente sus dos estrategias
   * de valuación propias (019-per-user-valuation-strategies, spec FR-001/FR-002).
   *
   * `rawUsername` (020-order-matching-engine, spec FR-001/FR-002) es
   * opcional a nivel de firma de TypeScript solo por compatibilidad con los
   * call sites existentes que invocan este método directamente sin pasar
   * por `RegisterRequestDto` (tests de integración de `AuthService` previos
   * a esta feature); `AuthController.register` SIEMPRE pasa el valor
   * validado por el DTO (`@IsNotEmpty()`), que es lo que efectivamente
   * garantiza el requisito a nivel de API.
   * @throws InvalidEmailError | InvalidPasswordError | EmailAlreadyInUseError | ReservedUsernameError
   */
  async register(rawEmail: string, rawPassword: string, rawUsername = ''): Promise<User> {
    const email = Email.create(rawEmail);
    const password = Password.create(rawPassword);
    const username = Username.create(rawUsername);

    if (await this.users.existsByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }

    const passwordHash = await this.hasher.hash(password.value());
    const user = User.register(this.ids.generate(), email, passwordHash, this.clock.now(), undefined, username.value());
    await this.users.save(user);
    await this.strategyProvisioning.provisionDefaultStrategiesFor(user.id);
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
