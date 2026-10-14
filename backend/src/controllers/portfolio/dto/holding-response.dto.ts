import { ApiProperty } from '@nestjs/swagger';
import { Holding } from '../../../domain/portfolio/holding';

export class HoldingResponseDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  readonly playerId: string;

  @ApiProperty({ example: 'Erling Haaland' })
  readonly playerName: string;

  @ApiProperty({ example: 10 })
  readonly tokenQuantity: number;

  @ApiProperty({ example: 120.5 })
  readonly averageBuyPrice: number;

  @ApiProperty({ example: 145.0 })
  readonly currentPrice: number;

  @ApiProperty({ example: 245.0 })
  readonly totalProfitLoss: number;

  constructor(props: {
    playerId: string;
    playerName: string;
    tokenQuantity: number;
    averageBuyPrice: number;
    currentPrice: number;
    totalProfitLoss: number;
  }) {
    this.playerId = props.playerId;
    this.playerName = props.playerName;
    this.tokenQuantity = props.tokenQuantity;
    this.averageBuyPrice = props.averageBuyPrice;
    this.currentPrice = props.currentPrice;
    this.totalProfitLoss = props.totalProfitLoss;
  }

  static fromDomain(holding: Holding): HoldingResponseDto {
    return new HoldingResponseDto({
      playerId: holding.playerId,
      playerName: holding.playerName,
      tokenQuantity: holding.tokenQuantity,
      averageBuyPrice: holding.averageBuyPrice,
      currentPrice: holding.currentPrice,
      totalProfitLoss: holding.totalProfitLoss,
    });
  }
}

