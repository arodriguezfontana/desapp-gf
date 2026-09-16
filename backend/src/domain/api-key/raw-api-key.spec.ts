import { InvalidApiKeyFormatError } from './errors/invalid-api-key-format.error';
import { RawApiKey } from './raw-api-key';

describe('RawApiKey', () => {
  describe('generate', () => {
    it('genera una clave con prefijo pmk_ y 68 caracteres en total', () => {
      const raw = RawApiKey.generate();
      const value = raw.toPlainText();

      expect(value).toHaveLength(68);
      expect(value.startsWith('pmk_')).toBe(true);
      expect(value).toMatch(/^pmk_[0-9a-f]{64}$/);
    });

    it('genera valores distintos e impredecibles en cada llamada', () => {
      const a = RawApiKey.generate().toPlainText();
      const b = RawApiKey.generate().toPlainText();
      expect(a).not.toBe(b);
    });
  });

  describe('of', () => {
    it('acepta un valor con formato válido', () => {
      const value = `pmk_${'a'.repeat(64)}`;
      expect(RawApiKey.of(value).toPlainText()).toBe(value);
    });

    it('rechaza un valor sin el prefijo correcto', () => {
      expect(() => RawApiKey.of(`xyz_${'a'.repeat(64)}`)).toThrow(
        InvalidApiKeyFormatError,
      );
    });

    it('rechaza un valor con longitud de entropía incorrecta', () => {
      expect(() => RawApiKey.of('pmk_abc')).toThrow(InvalidApiKeyFormatError);
    });

    it('rechaza un valor con caracteres no hexadecimales', () => {
      expect(() => RawApiKey.of(`pmk_${'z'.repeat(64)}`)).toThrow(
        InvalidApiKeyFormatError,
      );
    });
  });
});
