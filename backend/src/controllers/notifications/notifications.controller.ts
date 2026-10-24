import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { NotificationsService } from '../../services/notifications/notifications.service';
import { NotificationResponseDto } from './dto/notification-response.dto';

/**
 * Controller de notificaciones (025-player-price-alerts, contracts/notifications-api.md).
 * Protegido por el JwtAuthGuard global — todos sus endpoints son user-scoped.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las notificaciones propias del usuario autenticado, más recientes primero.' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async list(
    @CurrentUser() userId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationsService.listOwn(userId, unreadOnly === 'true');
    return notifications.map((n) => NotificationResponseDto.fromDomain(n));
  }

  @Patch(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marca una notificación propia como leída.' })
  @ApiParam({ name: 'id', description: 'ID de la notificación (UUID)', type: String })
  @ApiResponse({ status: 204, description: 'Notificación marcada como leída.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'La notificación no existe o no pertenece al usuario autenticado.' })
  async markAsRead(@CurrentUser() userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marca todas las notificaciones propias no leídas como leídas.' })
  @ApiResponse({ status: 204, description: 'Notificaciones marcadas como leídas.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async markAllAsRead(@CurrentUser() userId: string): Promise<void> {
    await this.notificationsService.markAllAsRead(userId);
  }
}
