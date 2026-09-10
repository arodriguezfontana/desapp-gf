import { Injectable } from '@nestjs/common';
import { Email } from '../../domain/email';
import { User } from '../../domain/user';
import { UserEntity } from '../entities/user.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class UserMapper {
  toDomain(entity: UserEntity): User {
    return User.register(
      entity.id,
      Email.create(entity.email),
      entity.passwordHash,
      entity.createdAt,
    );
  }

  toEntity(user: User): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id;
    entity.email = user.email.toString();
    entity.passwordHash = user.passwordHash;
    entity.createdAt = user.createdAt;
    return entity;
  }
}
