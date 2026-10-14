import { Holding } from './holding';

export class PortfolioSummary {
  constructor(
    public readonly totalInvested: number,
    public readonly totalCurrentValue: number,
    public readonly netProfitLoss: number,
  ) {}

  static fromHoldings(holdings: Holding[]): PortfolioSummary {
    const totalInvested = holdings.reduce(
      (acc, h) => acc + h.tokenQuantity * h.averageBuyPrice,
      0,
    );
    const totalCurrentValue = holdings.reduce(
      (acc, h) => acc + h.tokenQuantity * h.currentPrice,
      0,
    );
    const netProfitLoss = holdings.reduce(
      (acc, h) => acc + h.totalProfitLoss,
      0,
    );

    return new PortfolioSummary(
      Number(totalInvested.toFixed(2)),
      Number(totalCurrentValue.toFixed(2)),
      Number(netProfitLoss.toFixed(2)),
    );
  }
}

