import { ApiProperty } from '@nestjs/swagger';
import { OrderBook } from '../../../domain/orders/order-book';

/**
 * Representa un nivel de precio agrupado dentro del libro de órdenes (024-player-order-book).
 * Cumple con el anonimato estricto de mercado Level 2 (no expone usuario ni IDs de orden).
 */
export class PriceLevelDto {
  @ApiProperty({
    description: 'Precio unitario expresado en formato monetario estándar (2 decimales)',
    example: '25.00',
  })
  price!: string;

  @ApiProperty({
    description: 'Cantidad total acumulada de tokens disponibles en este nivel de precio',
    example: 15,
  })
  totalQuantity!: number;
}

/**
 * Respuesta del libro de órdenes agregadas para un jugador (024-player-order-book).
 */
export class OrderBookResponseDto {
  @ApiProperty({
    description: 'Identificador único del futbolista',
    example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  })
  playerId!: string;

  @ApiProperty({
    type: [PriceLevelDto],
    description: 'Niveles de demanda (BUY) ordenados de mayor a menor precio',
  })
  bids!: PriceLevelDto[];

  @ApiProperty({
    type: [PriceLevelDto],
    description: 'Niveles de oferta (SELL) ordenados de menor a mayor precio',
  })
  asks!: PriceLevelDto[];

  static fromDomain(orderBook: OrderBook): OrderBookResponseDto {
    const dto = new OrderBookResponseDto();
    dto.playerId = orderBook.playerId;
    dto.bids = orderBook.bids.map((b) => ({
      price: b.price.toFixed(2),
      totalQuantity: b.totalQuantity,
    }));
    dto.asks = orderBook.asks.map((a) => ({
      price: a.price.toFixed(2),
      totalQuantity: a.totalQuantity,
    }));
    return dto;
  }
}

