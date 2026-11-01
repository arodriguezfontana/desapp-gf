export class Holding {
  constructor(
    public readonly playerId: string,
    public readonly playerName: string,
    public readonly tokenQuantity: number,
    public readonly averageBuyPrice: number,
    public readonly currentPrice: number,
    public readonly totalProfitLoss: number,
  ) {}
}

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

export class Portfolio {
  constructor(
    public readonly userId: string,
    public readonly holdings: Holding[],
    public readonly summary: PortfolioSummary,
  ) {}

  static empty(userId: string): Portfolio {
    return new Portfolio(userId, [], new PortfolioSummary(0, 0, 0));
  }
}
