import { QuotationCacheInvalidationListener } from './quotation-cache-invalidation.listener';
import { QuoteRecalculatedEvent } from '../../../domain/alerts/events/quote-recalculated.event';
import { RedisCacheService } from '../../../shared/cache/redis-cache.service';

describe('QuotationCacheInvalidationListener', () => {
  let listener: QuotationCacheInvalidationListener;
  let mockCache: jest.Mocked<Partial<RedisCacheService>>;

  beforeEach(() => {
    mockCache = {
      delByPrefix: jest.fn().mockResolvedValue(undefined),
    };
    listener = new QuotationCacheInvalidationListener(mockCache as RedisCacheService);
  });

  it('invalida el prefijo de ranking del usuario al recibir quote.recalculated', async () => {
    const event = new QuoteRecalculatedEvent('user-123', 'player-456', 25000, new Date());

    await listener.handleQuoteRecalculated(event);

    expect(mockCache.delByPrefix).toHaveBeenCalledWith('futval:ranking:user-123:');
  });

  it('deduplica múltiples llamadas de invalidación para el mismo usuario en la misma ráfaga', async () => {
    const event1 = new QuoteRecalculatedEvent('user-123', 'player-1', 25000, new Date());
    const event2 = new QuoteRecalculatedEvent('user-123', 'player-2', 30000, new Date());

    await listener.handleQuoteRecalculated(event1);
    await listener.handleQuoteRecalculated(event2);

    expect(mockCache.delByPrefix).toHaveBeenCalledTimes(1);
    expect(mockCache.delByPrefix).toHaveBeenCalledWith('futval:ranking:user-123:');
  });

  it('invalidateUserRanking purga explícitamente el ranking del usuario indicado', async () => {
    await listener.invalidateUserRanking('user-999');

    expect(mockCache.delByPrefix).toHaveBeenCalledWith('futval:ranking:user-999:');
  });

  it('captura el error sin lanzar excepción si Redis falla', async () => {
    mockCache.delByPrefix = jest.fn().mockRejectedValue(new Error('Redis timeout'));

    await expect(listener.invalidateUserRanking('user-123')).resolves.not.toThrow();
  });
});
