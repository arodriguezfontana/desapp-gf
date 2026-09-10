import { Email } from '../domain/email';
import { User } from '../domain/user';

/**
 * Puerto de dominio para la persistencia de usuarios. Recibe y devuelve objetos
 * de dominio; el Service nunca ve la entidad de TypeORM. Token: USER_REPOSITORY.
 */
export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;
  existsByEmail(email: Email): Promise<boolean>;
  /**
   * Persiste un usuario nuevo. Si el email ya existe (incluso por una carrera
   * concurrente que evadio existsByEmail), lanza EmailAlreadyInUseError.
   */
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}
