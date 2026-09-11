import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../domain/user';

export class MeResponseDto {
  @ApiProperty({ example: '3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({ example: 'ana@mail.com' })
  email: string;

  private constructor(id: string, email: string) {
    this.id = id;
    this.email = email;
  }

  static fromDomain(user: User): MeResponseDto {
    return new MeResponseDto(user.id, user.email.toString());
  }
}
