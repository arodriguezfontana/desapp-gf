import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PortfolioController } from '../../controllers/portfolio/portfolio.controller';
import { PortfolioService } from '../../services/portfolio/portfolio.service';

@Module({
  imports: [AuthModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}

