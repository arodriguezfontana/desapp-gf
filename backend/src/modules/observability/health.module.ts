import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '../../controllers/observability/health.controller';
import { HealthService } from '../../services/observability/health.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
