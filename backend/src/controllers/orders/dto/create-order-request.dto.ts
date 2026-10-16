import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsUUID, Min } from 'class-validator';
import { OrderSide } from '../../../domain/orders/order-side';

/**
 * Body de POST /orders (020-order-matching-engine, contracts/orders-api.md).
 * Deliberadamente NO declara un campo `price`: el pipe global
 * (`forbidNonWhitelisted`) rechaza con 400 cualquier intento de enviarlo —
 * el precio SIEMPRE se calcula del lado del servidor (spec FR-008/FR-009).
 */
export class CreateOrderRequestDto {
  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  @IsEnum(OrderSide)
  side!: OrderSide;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  @IsUUID()
  playerId!: string;

  @ApiProperty({ example: 10, description: 'Cantidad de tokens, entero mayor a cero' })
  @IsInt()
  @Min(1)
  quantity!: number;
}
