import { Holding } from './holding';
import { PortfolioSummary } from './portfolio-summary';

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

