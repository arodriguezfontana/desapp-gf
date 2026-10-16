import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PortfolioController } from '../../controllers/portfolio/portfolio.controller';
import { TokenHoldingEntity } from '../../repositories/portfolio/entities/token-holding.entity';
import { TokenHoldingMapper } from '../../repositories/portfolio/mappers/token-holding.mapper';
import { TypeOrmTokenHoldingRepository } from '../../repositories/portfolio/typeorm-token-holding.repository';
import { PortfolioService } from '../../services/portfolio/portfolio.service';
import { TOKEN_HOLDING_REPOSITORY } from './portfolio.constants';

@Module({
  imports: [forwardRef(() => AuthModule), TypeOrmModule.forFeature([TokenHoldingEntity])],
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    TokenHoldingMapper,
    { provide: TOKEN_HOLDING_REPOSITORY, useClass: TypeOrmTokenHoldingRepository },
  ],
  exports: [PortfolioService, TOKEN_HOLDING_REPOSITORY],
})
export class PortfolioModule {}
