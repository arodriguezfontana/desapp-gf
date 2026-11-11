import { BadRequestException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { RequestValidationException } from '../observability/business-audit/request-validation.exception';
import { createGlobalValidationPipe } from './global-validation-pipe';

class DemoDto {
  @IsString()
  @MinLength(3)
  name!: string;
}

/** 030/028-US5: la validación de DTO se distingue de un 400 de un service, sin cambiar nada hacia afuera. */
describe('createGlobalValidationPipe: RequestValidationException', () => {
  const validate = () =>
    createGlobalValidationPipe().transform({ name: 'x' }, { type: 'body', metatype: DemoDto });

  it('ante un cuerpo inválido lanza una RequestValidationException', async () => {
    await expect(validate()).rejects.toBeInstanceOf(RequestValidationException);
  });

  it('sigue siendo un BadRequestException con status 400', async () => {
    const error = await validate().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
  });

  it('conserva el mensaje de validación traducido a español', async () => {
    const error = (await validate().catch((e: unknown) => e)) as BadRequestException;
    const message = (error.getResponse() as { message: string[] }).message;

    expect(message.join(' ')).toMatch(/name/i);
  });

  it('un BadRequestException común (como el de un service) no es una RequestValidationException', () => {
    expect(new BadRequestException('x')).not.toBeInstanceOf(RequestValidationException);
  });
});
