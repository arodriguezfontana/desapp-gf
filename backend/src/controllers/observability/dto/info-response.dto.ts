import { ApiProperty } from '@nestjs/swagger';

/** Información del servicio devuelta por `GET /info` (equivalente a `/actuator/info`). */
export class InfoResponseDto {
  @ApiProperty({ example: 'backend', description: 'Nombre del servicio, tomado del package.json.' })
  name!: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Versión del package.json; "unknown" si no se pudo leer.',
  })
  version!: string;

  @ApiProperty({
    example: '77a97ef',
    nullable: true,
    type: String,
    description: 'Commit desplegado, informado por el despliegue en la variable GIT_COMMIT; null si no se informó.',
  })
  commit!: string | null;

  @ApiProperty({
    example: 'production',
    description: 'Valor de NODE_ENV; "development" si no está definido.',
  })
  environment!: string;

  @ApiProperty({ example: 'v22.11.0', description: 'Versión de Node.js del proceso.' })
  node!: string;

  @ApiProperty({
    example: '2026-11-11T12:00:00.000Z',
    description: 'Momento en que arrancó el proceso (ISO 8601, UTC).',
  })
  startedAt!: string;

  @ApiProperty({ example: 3600, description: 'Segundos transcurridos desde el arranque (enteros).' })
  uptimeSeconds!: number;
}
