import { ApiProperty } from '@nestjs/swagger';
import { JWT_EXPIRES_IN_SECONDS } from '../../auth.constants';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ example: JWT_EXPIRES_IN_SECONDS, description: 'Segundos hasta el vencimiento.' })
  expiresIn: number;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.tokenType = 'Bearer';
    this.expiresIn = JWT_EXPIRES_IN_SECONDS;
  }
}
