import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../domain/notifications/notification';
import { NotificationRepository } from './notification.repository';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationMapper } from './notification.mapper';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
    private readonly mapper: NotificationMapper,
  ) {}

  async save(notification: Notification): Promise<Notification> {
    const saved = await this.repo.save(this.mapper.toPersistence(notification));
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<Notification | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findAllByUserId(userId: string, unreadOnly = false): Promise<Notification[]> {
    const entities = await this.repo.find({
      where: unreadOnly ? { userId, read: false } : { userId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async markAllAsReadByUserId(userId: string): Promise<void> {
    await this.repo.update({ userId, read: false }, { read: true });
  }
}
