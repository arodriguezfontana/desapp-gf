import { ForbiddenException } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from '../../services/portfolio/portfolio.service';
import { Portfolio } from '../../domain/portfolio/portfolio';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  let serviceMock: Partial<PortfolioService>;

  beforeEach(() => {
    serviceMock = {
      getPortfolioByUserId: jest.fn().mockResolvedValue(Portfolio.empty('user-1')),
    };
    controller = new PortfolioController(serviceMock as PortfolioService);
  });

  it('devuelve el portfolio del usuario cuando coincide con el usuario autenticado', async () => {
    const result = await controller.getPortfolio('user-1', 'user-1');

    expect(serviceMock.getPortfolioByUserId).toHaveBeenCalledWith('user-1');
    expect(result.holdings).toEqual([]);
    expect(result.summary.totalInvested).toBe(0);
  });

  it('lanza ForbiddenException cuando se intenta acceder al portfolio de otro usuario', async () => {
    await expect(controller.getPortfolio('user-2', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(serviceMock.getPortfolioByUserId).not.toHaveBeenCalled();
  });
});

