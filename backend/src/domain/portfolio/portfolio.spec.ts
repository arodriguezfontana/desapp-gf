import { Holding } from './holding';
import { Portfolio } from './portfolio';
import { PortfolioSummary } from './portfolio-summary';

describe('Portfolio domain', () => {
  it('crea un portfolio vacío correctamente', () => {
    const portfolio = Portfolio.empty('user-1');

    expect(portfolio.userId).toBe('user-1');
    expect(portfolio.holdings).toEqual([]);
    expect(portfolio.summary.totalInvested).toBe(0);
    expect(portfolio.summary.totalCurrentValue).toBe(0);
    expect(portfolio.summary.netProfitLoss).toBe(0);
  });

  it('calcula el resumen correctamente a partir de una lista de holdings', () => {
    const holdings = [
      new Holding('p1', 'Haaland', 10, 100, 120, 200),
      new Holding('p2', 'Mbappé', 5, 200, 180, -100),
    ];

    const summary = PortfolioSummary.fromHoldings(holdings);

    expect(summary.totalInvested).toBe(2000); // 10*100 + 5*200
    expect(summary.totalCurrentValue).toBe(2100); // 10*120 + 5*180
    expect(summary.netProfitLoss).toBe(100); // 200 + (-100)
  });
});

