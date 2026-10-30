import { Injectable } from '@nestjs/common';


import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';

import { AuthService } from '../auth/auth.service';
import { QuotationService } from '../quotation/quotation.service';

import { Holding } from '../../domain/portfolio/holding';
import { Portfolio } from '../../domain/portfolio/portfolio';
import { PortfolioSummary } from '../../domain/portfolio/portfolio-summary';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { roundToTwoDecimals } from '../../shared/numbers/round2';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly authService: AuthService,
    private readonly holdings: TokenHoldingRepository,
    private readonly transactions: TokenTransactionRepository,
    private readonly players: PlayerRepository,
    private readonly quotation: QuotationService,
  ) {}

  async getPortfolioByUserId(userId: string): Promise<Portfolio> {
    await this.authService.getById(userId);

    const tokenHoldings = await this.holdings.findByUserId(userId);
    const activeHoldings = tokenHoldings.filter((h) => h.quantity > 0);

    if (activeHoldings.length === 0) {
      return Portfolio.empty(userId);
    }

    const credits = await this.transactions.findCreditsByUserId(userId);
    const avgBuyPriceMap = this.computeAvgBuyPriceByPlayer(credits);

    const playerIds = new Set(activeHoldings.map((h) => h.playerId));
    const allPlayers = await this.players.findAllActive();
    const nameMap = new Map(allPlayers.map((p) => [p.id, p.name]));

    const valuationResults = await Promise.allSettled(
      activeHoldings.map((h) => this.quotation.valuate(userId, h.playerId)),
    );
    const valuationMap = new Map(
      activeHoldings.map((h, i) => {
        const r = valuationResults[i];
        return [h.playerId, r.status === 'fulfilled' ? roundToTwoDecimals(r.value.value) : null];
      }),
    );

    const holdingDtos: Holding[] = [];
    let totalInvested = 0;
    let totalCurrentValue = 0;

    for (const h of activeHoldings) {
      if (!playerIds.has(h.playerId)) continue;

      const playerName = nameMap.get(h.playerId) ?? h.playerId;
      const avgBuyPrice = avgBuyPriceMap.get(h.playerId) ?? 0;

      const currentPrice = valuationMap.get(h.playerId) ?? avgBuyPrice;

      const totalProfitLoss = roundToTwoDecimals((currentPrice - avgBuyPrice) * h.quantity);

      holdingDtos.push(
        new Holding(h.playerId, playerName, h.quantity, avgBuyPrice, currentPrice, totalProfitLoss),
      );

      totalInvested += avgBuyPrice * h.quantity;
      totalCurrentValue += currentPrice * h.quantity;
    }

    const summary = new PortfolioSummary(
      roundToTwoDecimals(totalInvested),
      roundToTwoDecimals(totalCurrentValue),
      roundToTwoDecimals(totalCurrentValue - totalInvested),
    );

    return new Portfolio(userId, holdingDtos, summary);
  }

  private computeAvgBuyPriceByPlayer(credits: TokenTransaction[]): Map<string, number> {
    const map = new Map<string, { totalCost: number; totalQty: number }>();

    for (const tx of credits) {
      const entry = map.get(tx.playerId) ?? { totalCost: 0, totalQty: 0 };
      entry.totalCost += tx.price * tx.quantity;
      entry.totalQty += tx.quantity;
      map.set(tx.playerId, entry);
    }

    const result = new Map<string, number>();
    for (const [playerId, { totalCost, totalQty }] of map) {
      result.set(playerId, totalQty > 0 ? roundToTwoDecimals(totalCost / totalQty) : 0);
    }
    return result;
  }
}
