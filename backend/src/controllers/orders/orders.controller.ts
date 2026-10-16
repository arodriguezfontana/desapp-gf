import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { OrdersService } from '../../services/orders/orders.service';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { TokenTransactionResponseDto } from './dto/token-transaction-response.dto';

/**
 * POST /orders (020-order-matching-engine, contracts/orders-api.md).
 * Protegido por el `JwtAuthGuard` global (constitucion, Principio IV) — sin
 * `@Public()`, asi que requiere JWT valido igual que cualquier otro
 * endpoint ligado a un usuario individual.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Publica una orden de compra o venta. El precio se calcula automáticamente con la estrategia seleccionada del usuario; nunca se recibe desde el cliente.',
  })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Body inválido, o holding insuficiente para una orden SELL' })
  @ApiResponse({ status: 401, description: 'No autorizado (sin JWT o con JWT inválido/expirado)' })
  @ApiResponse({ status: 404, description: 'El jugador indicado no existe en el catálogo' })
  async create(
    @CurrentUser() userId: string,
    @Body() dto: CreateOrderRequestDto,
  ): Promise<OrderResponseDto> {
    const result = await this.ordersService.createOrder(userId, dto.playerId, dto.side, dto.quantity);
    return OrderResponseDto.fromDomain(result.order, result.fills);
  }

  @Get('history')
  @ApiOperation({ summary: 'Devuelve el historial de transacciones de tokens del usuario autenticado, ordenado por fecha descendente.' })
  @ApiResponse({ status: 200, type: [TokenTransactionResponseDto] })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getHistory(@CurrentUser() userId: string): Promise<TokenTransactionResponseDto[]> {
    const transactions = await this.ordersService.getHistory(userId);
    return transactions.map((tx) => TokenTransactionResponseDto.fromDomain(tx));
  }
}
