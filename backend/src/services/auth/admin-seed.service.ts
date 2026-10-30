import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { CLOCK, ID_GENERATOR } from '../../modules/runtime/runtime.constants';
import { ConfigService } from '@nestjs/config';

import { PASSWORD_HASHER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { User } from '../../domain/auth/user';
import { parseSeedEmail, parseSeedPassword } from './seed-credentials.helper';
import { UserRole } from '../../domain/auth/user-role';
import { UserRepository } from '../../repositories/auth/user.repository';
import { UserStrategyProvisioningService } from '../quotation/user-strategy-provisioning.service';

/** Username fijo del admin seedeado (020-order-matching-engine): sin esto,
 *  `User.register` usaría el default `''` y el admin quedaría con un
 *  username vacío en vez de uno real, inconsistente con cualquier otro
 *  usuario (incluido el superusuario, que tiene el suyo fijo en
 *  `SuperuserSeedService`). No es único (spec FR-003), así que un valor
 *  fijo no colisiona con nada. */
const ADMIN_USERNAME = 'admin';

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
    private readonly strategyProvisioning: UserStrategyProvisioningService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async run(): Promise<void> {
    const rawEmail = this.config.get<string>('ADMIN_EMAIL');
    const rawPassword = this.config.get<string>('ADMIN_PASSWORD');

    if (!rawEmail || !rawPassword) {
      this.logger.warn('Seed de admin omitido: faltan ADMIN_EMAIL o ADMIN_PASSWORD.');
      return;
    }

    const email = parseSeedEmail(rawEmail);
    if (!email) {
      this.logger.warn('Seed de admin omitido: ADMIN_EMAIL no tiene un formato válido.');
      return;
    }

    if (await this.users.existsByEmail(email)) {
      this.logger.log('Admin ya existe: sin cambios.');
      return;
    }

    const password = parseSeedPassword(rawPassword);
    if (!password) {
      this.logger.warn('Seed de admin omitido: ADMIN_PASSWORD no cumple la política de contraseña.');
      return;
    }

    const passwordHash = await this.hasher.hash(password.value());
    const admin = User.register(
      this.ids.generate(),
      email,
      passwordHash,
      this.clock.now(),
      UserRole.ADMIN,
      ADMIN_USERNAME,
    );

    try {
      await this.users.save(admin);
      await this.strategyProvisioning.provisionDefaultStrategiesFor(admin.id);
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
