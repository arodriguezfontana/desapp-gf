import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  QUOTE_RECALCULATED_EVENT,
  QuoteRecalculatedEvent,
} from '../../../domain/alerts/events/quote-recalculated.event';
import { RedisCacheService } from '../../../shared/cache/redis-cache.service';

@Injectable()
export class QuotationCacheInvalidationListener {
  private readonly logger = new Logger(QuotationCacheInvalidationListener.name);
  private readonly invalidatedUsersInCycle = new Set<string>();

  constructor(@Optional() private readonly cache?: RedisCacheService) {}

  @OnEvent(QUOTE_RECALCULATED_EVENT, { async: true })
  async handleQuoteRecalculated(event: QuoteRecalculatedEvent): Promise<void> {
    if (!this.cache) return;

    // Deduplica invalidaciones en masa durante el mismo tick de recálculo
    if (this.invalidatedUsersInCycle.has(event.userId)) {
      return;
    }

    this.invalidatedUsersInCycle.add(event.userId);
    setTimeout(() => this.invalidatedUsersInCycle.delete(event.userId), 2000);

    try {
      await this.cache.delByPrefix(`futval:ranking:${event.userId}:`);
      this.logger.debug(`Caché de ranking purgada para usuario ${event.userId}`);
    } catch (err) {
      this.logger.warn(
        `Fallo al invalidar caché de ranking para usuario ${event.userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async invalidateUserRanking(userId: string): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.delByPrefix(`futval:ranking:${userId}:`);
      this.logger.debug(`Caché de ranking purgada manualmente para usuario ${userId}`);
    } catch (err) {
      this.logger.warn(
        `Fallo al invalidar caché de ranking para usuario ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
