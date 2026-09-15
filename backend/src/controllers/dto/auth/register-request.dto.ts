import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({ example: 'ana@mail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Abcd1234!',
    description:
      '8 a 16 caracteres, con al menos una mayúscula, una minúscula, un número y un carácter especial.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72) // guarda anti-DoS de bcrypt, no es la regla de negocio
  password!: string;
}
