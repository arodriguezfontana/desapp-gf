import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PASSWORD_HASHER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { Email } from '../../domain/auth/email';
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { InvalidEmailError } from '../../domain/auth/errors/invalid-email.error';
import { InvalidPasswordError } from '../../domain/auth/errors/invalid-password.error';
import { Password } from '../../domain/auth/password';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { UserRepository } from '../../repositories/auth/user.repository';

/**
 * Crea el primer admin al arrancar, a partir de `ADMIN_EMAIL` y `ADMIN_PASSWORD`
 * (spec 008, US2). Es idempotente y nunca modifica un usuario existente: si el
 * correo ya está tomado, no cambia su contraseña ni su rol.
 *
 * Los logs nombran la variable pero nunca su valor: ni la contraseña ni el correo
 * (constitución IV, datos personales fuera de logs).
 */
@Injectable()
export class AdminSeedService {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<void> {
    const rawEmail = this.config.get<string>('ADMIN_EMAIL');
    const rawPassword = this.config.get<string>('ADMIN_PASSWORD');

    if (!rawEmail || !rawPassword) {
      this.logger.warn('Seed de admin omitido: faltan ADMIN_EMAIL o ADMIN_PASSWORD.');
      return;
    }

    let email: Email;
    try {
      email = Email.create(rawEmail);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        this.logger.warn('Seed de admin omitido: ADMIN_EMAIL no tiene un formato válido.');
        return;
      }
      throw error;
    }

    if (await this.users.existsByEmail(email)) {
      this.logger.log('Admin ya existe: sin cambios.');
      return;
    }

    let password: Password;
    try {
      password = Password.create(rawPassword);
    } catch (error) {
      if (error instanceof InvalidPasswordError) {
        this.logger.warn('Seed de admin omitido: ADMIN_PASSWORD no cumple la política de contraseña.');
        return;
      }
      throw error;
    }

    const passwordHash = await this.hasher.hash(password.value());
    const admin = User.register(randomUUID(), email, passwordHash, new Date(), UserRole.ADMIN);

    try {
      await this.users.save(admin);
      this.logger.log('Admin creado.');
    } catch (error) {
      // Arranque concurrente: otra instancia ganó la carrera por el índice único de email.
      if (error instanceof EmailAlreadyInUseError) {
        this.logger.log('Admin ya existe: sin cambios.');
        return;
      }
      throw error;
    }
  }
}
