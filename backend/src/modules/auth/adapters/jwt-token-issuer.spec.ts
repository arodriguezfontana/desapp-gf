import { JwtService } from '@nestjs/jwt';
import { JwtTokenIssuer } from './jwt-token-issuer';
import { JWT_EXPIRES_IN_SECONDS } from '../auth.constants';

describe('JwtTokenIssuer', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const issuer = new JwtTokenIssuer(jwt);

  it('emite un JWT con sub = userId y exp = iat + 24h', () => {
    const token = issuer.issue('user-1');
    const decoded = jwt.decode(token) as { sub: string; iat: number; exp: number };

    expect(decoded.sub).toBe('user-1');
    expect(decoded.exp - decoded.iat).toBe(JWT_EXPIRES_IN_SECONDS);
    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'sub']);
  });

  it('verify devuelve el userId para un token recién emitido', () => {
    const token = issuer.issue('user-2');
    expect(issuer.verify(token)).toEqual({ userId: 'user-2' });
  });

  it('verify lanza si el token está manipulado', () => {
    const token = issuer.issue('user-3');
    expect(() => issuer.verify(token + 'x')).toThrow();
  });

  it('verify lanza si el token está vencido', () => {
    const expired = jwt.sign({ sub: 'user-4' }, { expiresIn: -10 });
    expect(() => issuer.verify(expired)).toThrow();
  });

  it('verify lanza si el token fue firmado con otro secreto', () => {
    const foreign = new JwtService({ secret: 'otro-secreto' }).sign({ sub: 'x' });
    expect(() => issuer.verify(foreign)).toThrow();
  });
});
