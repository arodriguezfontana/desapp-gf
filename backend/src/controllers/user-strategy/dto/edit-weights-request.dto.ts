import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class EditWeightsRequestDto {
  @ApiProperty({
    description: 'Reemplazo completo de los pesos generales. La suma debe dar 1.0 ±0.001.',
    example: { goals: 0.5, assists: 0.5 },
  })
  @IsObject()
  @IsNotEmpty()
  weights!: Record<string, number>;
}
