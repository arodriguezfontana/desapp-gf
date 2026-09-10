import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../domain/user';

export class RegisterResponseDto {
  @ApiProperty({ example: '3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({ example: 'ana@mail.com' })
  email: string;

  @ApiProperty({ example: '2026-09-09T14:03:22.000Z' })
  createdAt: string;

  private constructor(id: string, email: string, createdAt: string) {
    this.id = id;
    this.email = email;
    this.createdAt = createdAt;
  }

  static fromDomain(user: User): RegisterResponseDto {
    return new RegisterResponseDto(
      user.id,
      user.email.toString(),
      user.createdAt.toISOString(),
    );
  }
}
