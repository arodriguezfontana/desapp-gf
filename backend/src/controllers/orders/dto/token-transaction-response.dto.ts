import { ApiProperty } from '@nestjs/swagger';
import { TokenTransaction } from '../../../domain/orders/token-transaction';
import { TokenTransactionType } from '../../../domain/orders/token-transaction-type';
import { WithPlayerName } from '../../../shared/with-player-name';

/** Respuesta de GET /orders/history (historial de operaciones del usuario autenticado). */
export class TokenTransactionResponseDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id: string;

  @ApiProperty({ enum: TokenTransactionType })
  type: TokenTransactionType;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  playerId: string;

  @ApiProperty({ example: 'Lionel Messi' })
  playerName: string;

  @ApiProperty({ example: 10 })
  quantity: number;

  @ApiProperty({ example: '12.50' })
  price: string;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  orderId: string;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  counterpartOrderId: string;

  @ApiProperty({ example: '2026-10-16T12:00:00.000Z' })
  createdAt: string;

  private constructor(tx: WithPlayerName<TokenTransaction>) {
    this.id = tx.id;
    this.type = tx.type;
    this.playerId = tx.playerId;
    this.playerName = tx.playerName;
    this.quantity = tx.quantity;
    this.price = tx.price.toFixed(2);
    this.orderId = tx.orderId;
    this.counterpartOrderId = tx.counterpartOrderId;
    this.createdAt = tx.createdAt.toISOString();
  }

  static fromDomain(tx: WithPlayerName<TokenTransaction>): TokenTransactionResponseDto {
    return new TokenTransactionResponseDto(tx);
  }
}
