export interface Holding {
  playerId: string;
  playerName: string;
  tokenQuantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  totalProfitLoss: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  netProfitLoss: number;
}

export interface PortfolioResponse {
  holdings: Holding[];
  summary?: PortfolioSummary;
}

