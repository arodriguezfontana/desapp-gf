import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { map, Observable } from 'rxjs';
import { Public } from '../../guards/public.decorator';
import { SseJwtAuthGuard } from '../../guards/auth/sse-jwt-auth.guard';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { NotificationsService } from '../../services/notifications/notifications.service';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { Sla } from '../../shared/observability/metrics/sla';

/**
 * Push en vivo de notificaciones vía Server-Sent Events
 * (025-player-price-alerts, spec FR-018, contracts/notifications-api.md).
 * `@Public()` exime del JwtAuthGuard global; `SseJwtAuthGuard` autentica por
 * query param en su lugar (único mecanismo soportado por EventSource).
 */
@Controller('notifications')
@Public()
@UseGuards(SseJwtAuthGuard)
export class NotificationsSseController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse('stream')
  @Sla('stream')
  @ApiExcludeEndpoint()
  stream(@CurrentUser() userId: string): Observable<MessageEvent> {
    return this.notificationsService.subscribe(userId).pipe(
      map((notification) => ({ data: NotificationResponseDto.fromDomain(notification) })),
    );
  }
}
