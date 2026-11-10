import { Module } from '@nestjs/common';
import { SuperuserSeedService } from '../../services/auth/superuser-seed.service';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { PlayerModule } from '../player/player.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { QuotationModule } from '../quotation/quotation.module';
import { RuntimeModule } from '../runtime/runtime.module';

/**
 * Seed del superusuario de mercado (020-order-matching-engine, spec FR-004 a FR-007). Es un módulo
 * hoja —nadie lo importa; `main.ts` obtiene el servicio con `app.get(..., { strict: false })`— y
 * por eso puede depender de los módulos de mercado sin cerrar ciclos: antes vivía en `AuthModule`,
 * que por eso tenía que importar (con `forwardRef`) jugadores, órdenes y portafolio.
 */
@Module({
  imports: [
    RuntimeModule,
    PersistenceModule,
    AuthModule,
    PlayerModule,
    OrdersModule,
    PortfolioModule,
    QuotationModule,
  ],
  providers: [SuperuserSeedService],
})
export class SeedModule {}
