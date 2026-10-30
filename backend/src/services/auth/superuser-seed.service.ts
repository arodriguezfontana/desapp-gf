import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { CLOCK, ID_GENERATOR } from '../../modules/runtime/runtime.constants';
import { ConfigService } from '@nestjs/config';

import { PASSWORD_HASHER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';
import { ORDER_REPOSITORY } from '../../modules/orders/orders.constants';
import { TOKEN_HOLDING_REPOSITORY } from '../../modules/portfolio/portfolio.constants';

import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { Email } from '../../domain/auth/email';
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { User } from '../../domain/auth/user';
import { parseSeedEmail, parseSeedPassword } from './seed-credentials.helper';
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
import { UserStrategyProvisioningService } from '../quotation/user-strategy-provisioning.service';

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
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async run(): Promise<void> {
    const rawEmail = this.config.get<string>('SUPERUSER_EMAIL');
    const rawPassword = this.config.get<string>('SUPERUSER_PASSWORD');

    if (!rawEmail || !rawPassword) {
      this.logger.warn('Seed de superusuario omitido: faltan SUPERUSER_EMAIL o SUPERUSER_PASSWORD.');
      return;
    }

    const email = this.parseEmail(rawEmail);
    if (!email) return;

    const superuser = await this.findOrCreateSuperuser(email, rawPassword);
    if (!superuser) return;

    await this.ensureLiquidity(superuser.id);
  }

  private parseEmail(rawEmail: string): Email | null {
    const email = parseSeedEmail(rawEmail);
    if (!email) this.logger.warn('Seed de superusuario omitido: SUPERUSER_EMAIL no tiene un formato válido.');
    return email;
  }

  private async findOrCreateSuperuser(email: Email, rawPassword: string): Promise<User | null> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      this.logger.log('Superusuario ya existe: verificando liquidez inicial.');
      return existing;
    }

    const password = parseSeedPassword(rawPassword);
    if (!password) {
      this.logger.warn('Seed de superusuario omitido: SUPERUSER_PASSWORD no cumple la política de contraseña.');
      return null;
    }

    const passwordHash = await this.hasher.hash(password.value());
    let superuser = User.register(this.ids.generate(), email, passwordHash, this.clock.now(), UserRole.USER, SUPERUSER_USERNAME);

    try {
      await this.users.save(superuser);
    } catch (error) {
      if (error instanceof EmailAlreadyInUseError) {
        const found = await this.users.findByEmail(email);
        if (!found) throw error;
        superuser = found;
      } else {
        throw error;
      }
    }

    await this.strategyProvisioning.provisionDefaultStrategiesFor(superuser.id);
    this.logger.log('Superusuario creado.');
    return superuser;
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
      id: this.ids.generate(),
      userId,
      playerId,
      side: OrderSide.SELL,
      quantity: INITIAL_HOLDING_QUANTITY,
      price,
      createdAt: this.clock.now(),
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
