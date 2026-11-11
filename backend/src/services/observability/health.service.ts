import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthResponseDto } from '../../controllers/observability/dto/health-response.dto';

/** Tiempo máximo que se espera a que la base responda al ping (spec 027, FR-009). */
export const DATABASE_PING_TIMEOUT_MS = 3000;

/**
 * Health check del backend (spec 027). La única dependencia verificada es la base de
 * datos: las APIs externas (Football-Data, WhoScored) solo se usan en tareas
 * programadas y no participan de ningún request de usuario.
 *
 * Terminus lanza `ServiceUnavailableException(resultado)` cuando algún componente
 * cae, pero el filtro global de excepciones reescribiría ese cuerpo y se perderían
 * `status` y el detalle por componente. Por eso se atrapa acá y se devuelve el
 * informe; quien llama decide el código HTTP (research.md §2).
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeOrm: TypeOrmHealthIndicator,
  ) {}

  async check(): Promise<HealthResponseDto> {
    try {
      return (await this.health.check([
        () => this.typeOrm.pingCheck('database', { timeout: DATABASE_PING_TIMEOUT_MS }),
      ])) as HealthResponseDto;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return error.getResponse() as HealthResponseDto;
      }
      throw error;
    }
  }
}
