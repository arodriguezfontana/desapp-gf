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

