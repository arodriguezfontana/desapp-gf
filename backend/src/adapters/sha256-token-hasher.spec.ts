import { Sha256TokenHasher } from './sha256-token-hasher';

describe('Sha256TokenHasher', () => {
  let hasher: Sha256TokenHasher;

  beforeEach(() => {
    hasher = new Sha256TokenHasher();
  });

  it('debe generar un hash SHA-256 determinístico de 64 caracteres hexadecimales', () => {
    const token = 'pmk_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const hash1 = hasher.hash(token);
    const hash2 = hasher.hash(token);

    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('debe retornar true cuando el token coincide con el hash', () => {
    const token = 'pmk_test_token_123';
    const hash = hasher.hash(token);

    expect(hasher.compare(token, hash)).toBe(true);
  });

  it('debe retornar false cuando el token no coincide con el hash', () => {
    const token = 'pmk_token_original';
    const hash = hasher.hash(token);

    expect(hasher.compare('pmk_token_diferente', hash)).toBe(false);
  });

  it('debe retornar false cuando el hash tiene una longitud distinta o formato inválido sin lanzar error', () => {
    const token = 'pmk_token';

    expect(hasher.compare(token, 'invalid_short_hash')).toBe(false);
    expect(hasher.compare(token, '')).toBe(false);
  });
});

