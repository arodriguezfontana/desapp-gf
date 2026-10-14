import { ApiProperty } from '@nestjs/swagger';
import { HoldingResponseDto } from './holding-response.dto';
import { PortfolioSummaryResponseDto } from './portfolio-summary-response.dto';
import { Portfolio } from '../../../domain/portfolio/portfolio';

export class PortfolioResponseDto {
  @ApiProperty({ type: [HoldingResponseDto] })
  readonly holdings: HoldingResponseDto[];

  @ApiProperty({ type: PortfolioSummaryResponseDto })
  readonly summary: PortfolioSummaryResponseDto;

  constructor(holdings: HoldingResponseDto[], summary: PortfolioSummaryResponseDto) {
    this.holdings = holdings;
    this.summary = summary;
  }

  static fromDomain(portfolio: Portfolio): PortfolioResponseDto {
    return new PortfolioResponseDto(
      portfolio.holdings.map(HoldingResponseDto.fromDomain),
      PortfolioSummaryResponseDto.fromDomain(portfolio.summary),
    );
  }
}

