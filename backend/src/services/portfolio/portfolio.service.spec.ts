import { PortfolioService } from './portfolio.service';
import { AuthService } from '../auth/auth.service';
import { User } from '../../domain/auth/user';
import { Email } from '../../domain/auth/email';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import type { QuotationService } from '../quotation/quotation.service';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let authServiceMock: Partial<AuthService>;
  let holdingRepoMock: Partial<TokenHoldingRepository>;
  let txRepoMock: Partial<TokenTransactionRepository>;
  let playerRepoMock: Partial<PlayerRepository>;
  let quotationMock: Partial<QuotationService>;

  beforeEach(() => {
    authServiceMock = {
      getById: jest.fn().mockResolvedValue(
        User.register('user-1', Email.create('test@mail.com'), 'hash', new Date()),
      ),
    };
    holdingRepoMock = { findByUserId: jest.fn().mockResolvedValue([]) };
    txRepoMock = { findCreditsByUserId: jest.fn().mockResolvedValue([]) };
    playerRepoMock = { findAllActive: jest.fn().mockResolvedValue([]) };
    quotationMock = { valuate: jest.fn() };

    service = new PortfolioService(
      authServiceMock as AuthService,
      holdingRepoMock as TokenHoldingRepository,
      txRepoMock as TokenTransactionRepository,
      playerRepoMock as PlayerRepository,
      quotationMock as QuotationService,
    );
  });

  it('valida la existencia del usuario y retorna un portfolio vacío si no tiene tenencias', async () => {
    const result = await service.getPortfolioByUserId('user-1');

    expect(authServiceMock.getById).toHaveBeenCalledWith('user-1');
    expect(result.userId).toBe('user-1');
    expect(result.holdings).toEqual([]);
    expect(result.summary.totalInvested).toBe(0);
  });

  it('propaga error si el usuario no existe', async () => {
    (authServiceMock.getById as jest.Mock).mockRejectedValueOnce(
      new Error('Usuario no encontrado'),
    );

    await expect(service.getPortfolioByUserId('inexistente')).rejects.toThrow(
      'Usuario no encontrado',
    );
  });
});
