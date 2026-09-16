import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_EXPIRES_IN } from '../auth.constants';
import { TokenIssuer } from './token-issuer';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(userId: string): string {
    const payload: JwtPayload = { sub: userId };
    return this.jwt.sign(payload, { expiresIn: JWT_EXPIRES_IN });
  }

  verify(token: string): { userId: string } {
    const payload = this.jwt.verify<JwtPayload>(token);
    return { userId: payload.sub };
  }
}
