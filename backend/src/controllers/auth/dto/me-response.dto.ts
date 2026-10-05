import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../domain/auth/user';
import { UserRole } from '../../../domain/auth/user-role';

export class MeResponseDto {
  @ApiProperty({ example: '3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({ example: 'ana@mail.com' })
  email: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: 'Rol del usuario autenticado. Default `user`; sólo el seed crea `admin`.',
  })
  role: UserRole;

  private constructor(id: string, email: string, role: UserRole) {
    this.id = id;
    this.email = email;
    this.role = role;
  }

  static fromDomain(user: User): MeResponseDto {
    return new MeResponseDto(user.id, user.email.toString(), user.role);
  }
}
