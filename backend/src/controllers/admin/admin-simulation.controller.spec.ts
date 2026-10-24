import { AdminSimulationController } from './admin-simulation.controller';
import { MarketSimulationService } from '../../services/admin/market-simulation.service';
import { SimulationResultDto } from './dto/simulation-result.dto';

describe('AdminSimulationController', () => {
  let controller: AdminSimulationController;
  let service: jest.Mocked<MarketSimulationService>;

  beforeEach(() => {
    service = {
      simulate: jest.fn(),
    } as unknown as jest.Mocked<MarketSimulationService>;

    controller = new AdminSimulationController(service);
  });

  it('invoca a MarketSimulationService.simulate y retorna el resultado', async () => {
    const mockResult: SimulationResultDto = {
      success: true,
      message: 'Simulación completada con éxito.',
      adminEmail: 'abi_admin@ejemplo.com',
      holdingsCreated: 4,
      transactionsCreated: 9,
      ordersCreated: 4,
      marketOrdersCreated: 24,
      quotesCreated: 20,
      playersInvolved: ['Player One', 'Player Two'],
      quotes: [
        { playerId: 'p-1', playerName: 'Player One', value: 24.5 },
        { playerId: 'p-2', playerName: 'Player Two', value: 18.3 },
      ],
      alertsCreated: 2,
    };

    service.simulate.mockResolvedValue(mockResult);

    const result = await controller.simulateMarket();

    expect(result).toEqual(mockResult);
    expect(service.simulate).toHaveBeenCalledTimes(1);
  });
});

