import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PASSWORD_HASHER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';
import { ORDER_REPOSITORY } from '../../modules/orders/orders.constants';
import { TOKEN_HOLDING_REPOSITORY } from '../../modules/portfolio/portfolio.constants';

import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { Email } from '../../domain/auth/email';
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { InvalidEmailError } from '../../domain/auth/errors/invalid-email.error';
import { InvalidPasswordError } from '../../domain/auth/errors/invalid-password.error';
import { Password } from '../../domain/auth/password';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { TokenHolding } from '../../domain/portfolio/token-holding';

import { UserRepository } from '../../repositories/auth/user.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';

import { QuotationService } from '../quotation/quotation.service';
import { roundToTwoDecimals } from '../../shared/numbers/round2';
import { UserStrategyProvisioningService } from './user-strategy-provisioning.service';

const SUPERUSER_USERNAME = 'superuser';
const INITIAL_HOLDING_QUANTITY = 100;

/**
 * Crea al superusuario al arrancar, a partir de `SUPERUSER_EMAIL` y
 * `SUPERUSER_PASSWORD` (020-order-matching-engine, spec FR-004 a FR-007,
 * research.md D3). Mismo patron idempotente que `AdminSeedService`, pero la
 * idempotencia se verifica por `username` (no por email, ver research.md
 * D2/D3: `username` no es unico en general).
 *
 * Al crearlo: le provisiona sus dos estrategias de valuacion propias (mismo
 * hook que cualquier alta normal, spec FR-005), le carga un holding de 100
 * tokens por cada jugador del catalogo, y publica por cada jugador una
 * Order SELL PENDING por esos 100 tokens al precio de su propia estrategia
 * seleccionada (spec FR-006/FR-007) — el mismo calculo que expone
 * GET /players/:id/valuation, nunca uno manual.
 *
 * Los logs nombran la variable pero nunca su valor (constitucion, Principio IV).
 */
@Injectable()
export class SuperuserSeedService {
  private readonly logger = new Logger(SuperuserSeedService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(TOKEN_HOLDING_REPOSITORY) private readonly holdings: TokenHoldingRepository,
    private readonly config: ConfigService,
    private readonly strategyProvisioning: UserStrategyProvisioningService,
    private readonly quotation: QuotationService,
  ) {}

  async run(): Promise<void> {
    const rawEmail = this.config.get<string>('SUPERUSER_EMAIL');
    const rawPassword = this.config.get<string>('SUPERUSER_PASSWORD');

    if (!rawEmail || !rawPassword) {
      this.logger.warn('Seed de superusuario omitido: faltan SUPERUSER_EMAIL o SUPERUSER_PASSWORD.');
      return;
    }

    let email: Email;
    try {
      email = Email.create(rawEmail);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        this.logger.warn('Seed de superusuario omitido: SUPERUSER_EMAIL no tiene un formato válido.');
        return;
      }
      throw error;
    }

    let superuser = await this.users.findByEmail(email);

    if (!superuser) {
      let password: Password;
      try {
        password = Password.create(rawPassword);
      } catch (error) {
        if (error instanceof InvalidPasswordError) {
          this.logger.warn('Seed de superusuario omitido: SUPERUSER_PASSWORD no cumple la política de contraseña.');
          return;
        }
        throw error;
      }

      const passwordHash = await this.hasher.hash(password.value());
      superuser = User.register(
        randomUUID(),
        email,
        passwordHash,
        new Date(),
        UserRole.USER,
        SUPERUSER_USERNAME,
      );

      try {
        await this.users.save(superuser);
      } catch (error) {
        if (error instanceof EmailAlreadyInUseError) {
          // Carrera concurrente: re-leer el usuario creado por la otra instancia.
          superuser = await this.users.findByEmail(email);
          if (!superuser) throw error;
        } else {
          throw error;
        }
      }

      await this.strategyProvisioning.provisionDefaultStrategiesFor(superuser.id);
      this.logger.log('Superusuario creado.');
    } else {
      this.logger.log('Superusuario ya existe: verificando liquidez inicial.');
    }

    await this.ensureLiquidity(superuser.id);
  }

  private async resolvePrice(userId: string, playerId: string): Promise<number> {
    try {
      const valuation = await this.quotation.valuate(userId, playerId);
      return roundToTwoDecimals(valuation.value);
    } catch {
      this.logger.warn(`Sin cotización para jugador ${playerId}; se usa precio de fallback 1.`);
      return 1;
    }
  }

  private async provisionPlayer(userId: string, playerId: string): Promise<boolean> {
    const existing = await this.holdings.findByUserAndPlayer(userId, playerId);
    if (existing && existing.quantity > 0) return false;

    const holding = TokenHolding.createEmpty(userId, playerId).credit(INITIAL_HOLDING_QUANTITY);
    await this.holdings.save(holding);

    const price = await this.resolvePrice(userId, playerId);
    const order = Order.create({
      id: randomUUID(),
      userId,
      playerId,
      side: OrderSide.SELL,
      quantity: INITIAL_HOLDING_QUANTITY,
      price,
      createdAt: new Date(),
    });
    await this.orders.save(order);
    return true;
  }

  private async ensureLiquidity(userId: string): Promise<void> {
    const catalogPlayers = await this.players.findAllActive();
    if (catalogPlayers.length === 0) return;

    // Si ya tiene holding para el primer jugador, asumimos que la liquidez ya fue provisionada.
    const firstHolding = await this.holdings.findByUserAndPlayer(userId, catalogPlayers[0].id);
    if (firstHolding && firstHolding.quantity > 0) {
      this.logger.log('Liquidez inicial ya provisionada: sin cambios.');
      return;
    }

    let provisioned = 0;
    for (const player of catalogPlayers) {
      try {
        const added = await this.provisionPlayer(userId, player.id);
        if (added) provisioned++;
      } catch (err) {
        this.logger.warn(`Error provisionando liquidez para jugador ${player.id}: ${String(err)}`);
      }
    }

    this.logger.log(`Liquidez inicial provisionada en ${provisioned} jugador(es).`);
  }
}
