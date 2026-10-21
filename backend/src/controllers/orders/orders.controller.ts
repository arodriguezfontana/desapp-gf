import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { OrdersService } from '../../services/orders/orders.service';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { TokenTransactionResponseDto } from './dto/token-transaction-response.dto';

/**
 * Controller de Orders (020-order-matching-engine, 023-cancel-order, contracts/orders-api.md).
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

  @Delete(':id')
  @ApiOperation({
    summary:
      'Cancela una orden propia en estado PENDING o PARTIALLY_FILLED. Retira el remanente del mercado y libera los tokens retenidos si era una venta.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Orden cancelada exitosamente', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'El parámetro :id no es un identificador UUID válido.' })
  @ApiResponse({ status: 401, description: 'No autorizado (sin JWT o con JWT inválido/expirado)' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para operar sobre esta orden.' })
  @ApiResponse({ status: 404, description: 'La orden solicitada no existe.' })
  @ApiResponse({ status: 409, description: 'La orden no se puede cancelar porque ya fue completada o cancelada previamente.' })
  async cancel(
    @CurrentUser() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const cancelled = await this.ordersService.cancelOrder(id, userId);
    return OrderResponseDto.fromDomain(cancelled);
  }

  @Get()
  @ApiOperation({
    summary: 'Devuelve todas las órdenes emitidas por el usuario autenticado ordenadas por fecha descendente.',
  })
  @ApiResponse({ status: 200, description: 'Listado de órdenes del usuario', type: [OrderResponseDto] })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getOrders(@CurrentUser() userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.ordersService.getUserOrders(userId);
    return orders.map((order) => OrderResponseDto.fromDomain(order));
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
