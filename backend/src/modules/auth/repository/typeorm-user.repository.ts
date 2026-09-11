import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Email } from '../domain/email';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error';
import { User } from '../domain/user';
import { UserEntity } from './entities/user.entity';
import { UserMapper } from './mappers/user.mapper';
import { UserRepository } from './user.repository';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
    private readonly mapper: UserMapper,
  ) {}

  async findByEmail(email: Email): Promise<User | null> {
    const entity = await this.repo.findOne({
      where: { email: email.toString() },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    return this.repo.existsBy({ email: email.toString() });
  }

  async save(user: User): Promise<void> {
    try {
      await this.repo.insert(this.mapper.toEntity(user));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
      ) {
        throw new EmailAlreadyInUseError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }
}
