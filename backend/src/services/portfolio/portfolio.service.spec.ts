import { PortfolioService } from './portfolio.service';
import { AuthService } from '../auth/auth.service';
import { User } from '../../domain/auth/user';
import { Email } from '../../domain/auth/email';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let authServiceMock: Partial<AuthService>;

  beforeEach(() => {
    authServiceMock = {
      getById: jest.fn().mockResolvedValue(
        User.register('user-1', Email.create('test@mail.com'), 'hash', new Date()),
      ),
    };
    service = new PortfolioService(authServiceMock as AuthService);
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

