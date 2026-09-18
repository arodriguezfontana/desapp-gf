import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, Min } from 'class-validator';
import { createGlobalValidationPipe } from './global-validation-pipe';

/**
 * Prueba la integración real class-validator -> NestJS ValidationPipe ->
 * `exceptionFactory`, no sólo `translateValidationErrors` en aislamiento (esa ya
 * tiene su propio unit test). Sin esto, un cambio en cómo NestJS arma el
 * `ValidationPipe` podría romper la traducción sin que ningún test lo detecte.
 */
class SampleDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}

const metadata: ArgumentMetadata = { type: 'body', metatype: SampleDto, data: '' };

describe('createGlobalValidationPipe', () => {
  it('deja pasar un payload válido y lo transforma a instancia del DTO', async () => {
    const pipe = createGlobalValidationPipe();
    const result = await pipe.transform({ email: 'ana@mail.com' }, metadata);
    expect(result).toBeInstanceOf(SampleDto);
    expect(result.email).toBe('ana@mail.com');
  });

  it('rechaza con BadRequestException y mensaje en español para un email inválido', async () => {
    const pipe = createGlobalValidationPipe();

    await expect(
      pipe.transform({ email: 'no-es-un-email' }, metadata),
    ).rejects.toThrow(BadRequestException);

    try {
      await pipe.transform({ email: 'no-es-un-email' }, metadata);
      fail('debía lanzar BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(response.message).toEqual([
        "El campo 'email' debe ser un email válido.",
      ]);
      expect(response.message.join(' ')).not.toMatch(/must be/i);
    }
  });

  it('traduce un constraint numérico (min) extrayendo el valor del mensaje default', async () => {
    const pipe = createGlobalValidationPipe();

    try {
      await pipe.transform({ email: 'ana@mail.com', page: 0 }, metadata);
      fail('debía lanzar BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(response.message).toContain(
        "El campo 'page' debe ser mayor o igual a 1.",
      );
    }
  });

  it('rechaza propiedades no declaradas con el mensaje de whitelist en español', async () => {
    const pipe = createGlobalValidationPipe();

    try {
      await pipe.transform(
        { email: 'ana@mail.com', propiedadInventada: 'x' },
        metadata,
      );
      fail('debía lanzar BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(response.message).toEqual([
        "La propiedad 'propiedadInventada' no está permitida en la solicitud.",
      ]);
    }
  });
});
