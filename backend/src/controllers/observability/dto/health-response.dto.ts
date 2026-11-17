import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ComponentState, ComponentStatus, HealthReport } from '../../../services/observability/health-report';

/** Estado individual de una dependencia verificada por el health check. */
export class ComponentStatusDto implements ComponentStatus {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: ComponentState;

  @ApiPropertyOptional({
    example: 'timeout of 3000ms exceeded',
    description:
      'Solo cuando el componente está caído por timeout. Nunca incluye el error original ni datos de conexión.',
  })
  message?: string;
}

/** Mapa componente -> estado (hoy el único componente es `database`). */
export type ComponentStatusMap = Record<string, ComponentStatusDto>;

/** Informe de salud devuelto por `GET /health` (200 si `status` es `ok`, 503 en otro caso). */
export class HealthResponseDto implements HealthReport {
  @ApiProperty({ enum: ['ok', 'error', 'shutting_down'], example: 'ok' })
  status!: 'ok' | 'error' | 'shutting_down';

  @ApiProperty({
    description: 'Componentes en estado `up`.',
    example: { database: { status: 'up' } },
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/ComponentStatusDto' },
  })
  info!: ComponentStatusMap;

  @ApiProperty({
    description: 'Componentes en estado `down`.',
    example: {},
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/ComponentStatusDto' },
  })
  error!: ComponentStatusMap;

  @ApiProperty({
    description: 'Todos los componentes verificados, con su estado individual.',
    example: { database: { status: 'up' } },
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/ComponentStatusDto' },
  })
  details!: ComponentStatusMap;
}
