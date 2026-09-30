import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  let hasher: BcryptPasswordHasher;

  beforeEach(() => {
    hasher = new BcryptPasswordHasher();
  });

  it('debe retornar true al comparar una contraseña contra su propio hash', async () => {
    const hash = await hasher.hash('mi-password-123');

    expect(await hasher.compare('mi-password-123', hash)).toBe(true);
  });

  it('debe retornar false al comparar una contraseña distinta a la del hash', async () => {
    const hash = await hasher.hash('mi-password-123');

    expect(await hasher.compare('otra-password', hash)).toBe(false);
  });

  it('debe generar hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const hash1 = await hasher.hash('mi-password-123');
    const hash2 = await hasher.hash('mi-password-123');

    expect(hash1).not.toBe(hash2);
  });

  it('timingSafeDummyHash debe ser un hash bcrypt válido para compare', async () => {
    expect(hasher.timingSafeDummyHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(
      await hasher.compare('dummy-password-timing-defense', hasher.timingSafeDummyHash),
    ).toBe(true);
  });
});
