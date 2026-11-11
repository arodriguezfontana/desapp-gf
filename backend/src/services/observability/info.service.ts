import { Inject, Injectable } from '@nestjs/common';
import type { Clock } from '../../adapters/runtime/clock';
import { InfoResponseDto } from '../../controllers/observability/dto/info-response.dto';
import { BUILD_INFO } from '../../modules/observability/info.constants';
import { CLOCK } from '../../modules/runtime/runtime.constants';
import type { BuildInfo } from '../../shared/observability/info/build-info';

/**
 * Información del servicio (equivalente a `/actuator/info`): datos del build más el arranque y el
 * uptime del proceso. El arranque se toma al construir el servicio, que Nest instancia una sola vez
 * durante el bootstrap.
 */
@Injectable()
export class InfoService {
  private readonly startedAt: Date;

  constructor(
    @Inject(BUILD_INFO) private readonly build: BuildInfo,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.startedAt = clock.now();
  }

  getInfo(): InfoResponseDto {
    const elapsedMs = this.clock.now().getTime() - this.startedAt.getTime();
    return {
      ...this.build,
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.max(0, Math.floor(elapsedMs / 1000)),
    };
  }
}
