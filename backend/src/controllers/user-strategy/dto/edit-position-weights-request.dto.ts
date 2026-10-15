import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class EditPositionWeightsRequestDto {
  @ApiProperty({
    description: 'Reemplazo completo del perfil de esa posición. La suma debe dar 1.0 ±0.001.',
    example: { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 },
  })
  @IsObject()
  @IsNotEmpty()
  weights!: Record<string, number>;
}
