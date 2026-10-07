import { Injectable } from '@nestjs/common';
import { Email } from '../../../domain/auth/email';
import { User } from '../../../domain/auth/user';
import { parseUserRole } from '../../../domain/auth/user-role';
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
      parseUserRole(entity.role),
    );
  }

  toEntity(user: User): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id;
    entity.email = user.email.toString();
    entity.passwordHash = user.passwordHash;
    entity.createdAt = user.createdAt;
    entity.role = user.role;
    return entity;
  }
}
