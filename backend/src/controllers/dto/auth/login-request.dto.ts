import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'ana@mail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Abcd1234!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
