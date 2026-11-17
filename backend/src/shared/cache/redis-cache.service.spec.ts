import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import type { Redis } from 'ioredis';

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let mockClient: jest.Mocked<Partial<Redis>>;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      pipeline: jest.fn(),
      scanStream: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: unknown) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return defaultVal;
      }),
    };

    service = new RedisCacheService(
      mockConfigService as ConfigService,
      mockClient as unknown as Redis,
    );
  });

  describe('get', () => {
    it('retorna null si la clave no existe', async () => {
      (mockClient.get as jest.Mock).mockResolvedValue(null);

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('test-key');
    });

    it('retorna el objeto parseado si existe en caché', async () => {
      const payload = { name: 'Player 1', rating: 7.5 };
      (mockClient.get as jest.Mock).mockResolvedValue(JSON.stringify(payload));

      const result = await service.get('test-key');

      expect(result).toEqual(payload);
    });

    it('falla de forma abierta (fail-open) y retorna null si Redis lanza un error', async () => {
      (mockClient.get as jest.Mock).mockRejectedValue(new Error('Connection lost'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('retorna null (fail-open) sin arrojar excepción si el contenido en Redis es un JSON corrupto', async () => {
      (mockClient.get as jest.Mock).mockResolvedValue('invalid-json{{{');

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('retorna null inmediatamente si no hay cliente Redis configurado', async () => {
      const serviceWithoutClient = new RedisCacheService(mockConfigService as ConfigService, undefined);

      const result = await serviceWithoutClient.get('any-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('soporta caracteres especiales y unicode en el payload', async () => {
      const payload = { name: 'Lionel Messi ⚽', team: 'Atlético de Madrid', description: 'Cotización especial — € 100M' };
      (mockClient.set as jest.Mock).mockResolvedValue('OK');

      await service.set('test-unicode', payload, 3600);

      expect(mockClient.set).toHaveBeenCalledWith(
        'test-unicode',
        JSON.stringify(payload),
        'EX',
        3600,
      );
    });
    it('guarda el valor serializado en JSON con TTL', async () => {
      const payload = { id: 'uuid-1', total: 10 };
      (mockClient.set as jest.Mock).mockResolvedValue('OK');

      await service.set('test-key', payload, 3600);

      expect(mockClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(payload),
        'EX',
        3600,
      );
    });

    it('guarda el valor serializado sin TTL si no se especifica', async () => {
      const payload = { id: 'uuid-1' };
      (mockClient.set as jest.Mock).mockResolvedValue('OK');

      await service.set('test-key', payload);

      expect(mockClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(payload),
      );
    });

    it('falla de forma abierta (fail-open) si Redis falla al escribir', async () => {
      (mockClient.set as jest.Mock).mockRejectedValue(new Error('Out of memory'));

      await expect(service.set('test-key', { a: 1 })).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('elimina la clave solicitada', async () => {
      (mockClient.del as jest.Mock).mockResolvedValue(1);

      await service.del('test-key');

      expect(mockClient.del).toHaveBeenCalledWith('test-key');
    });

    it('captura el error si falla la eliminación', async () => {
      (mockClient.del as jest.Mock).mockRejectedValue(new Error('Redis down'));

      await expect(service.del('test-key')).resolves.not.toThrow();
    });
  });

  describe('ping', () => {
    it('retorna true si responde PONG', async () => {
      (mockClient.ping as jest.Mock).mockResolvedValue('PONG');
      expect(await service.ping()).toBe(true);
    });

    it('retorna false si Redis falla o responde diferente', async () => {
      (mockClient.ping as jest.Mock).mockRejectedValue(new Error('Timeout'));
      expect(await service.ping()).toBe(false);
    });
  });
});
