import { ApiProperty } from '@nestjs/swagger';
import { PortfolioSummary } from '../../../domain/portfolio/portfolio-summary';

export class PortfolioSummaryResponseDto {
  @ApiProperty({ example: 1205.0 })
  readonly totalInvested: number;

  @ApiProperty({ example: 1450.0 })
  readonly totalCurrentValue: number;

  @ApiProperty({ example: 245.0 })
  readonly netProfitLoss: number;

  constructor(props: {
    totalInvested: number;
    totalCurrentValue: number;
    netProfitLoss: number;
  }) {
    this.totalInvested = props.totalInvested;
    this.totalCurrentValue = props.totalCurrentValue;
    this.netProfitLoss = props.netProfitLoss;
  }

  static fromDomain(summary: PortfolioSummary): PortfolioSummaryResponseDto {
    return new PortfolioSummaryResponseDto({
      totalInvested: summary.totalInvested,
      totalCurrentValue: summary.totalCurrentValue,
      netProfitLoss: summary.netProfitLoss,
    });
  }
}

