import { generateRawApiKey } from './raw-api-key';

describe('generateRawApiKey', () => {
  it('genera una clave con prefijo pmk_ y 68 caracteres en total', () => {
    const value = generateRawApiKey();

    expect(value).toHaveLength(68);
    expect(value.startsWith('pmk_')).toBe(true);
    expect(value).toMatch(/^pmk_[0-9a-f]{64}$/);
  });

  it('genera valores distintos e impredecibles en cada llamada', () => {
    const a = generateRawApiKey();
    const b = generateRawApiKey();
    expect(a).not.toBe(b);
  });
});
