import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { translateValidationErrors } from './spanish-validation-messages';

/**
 * Único punto donde se configura el `ValidationPipe` global de la app, para que
 * `main.ts` (runtime real) y `test/test-app.ts` (e2e) usen exactamente la misma
 * configuración — incluida la traducción de mensajes a español.
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException(translateValidationErrors(errors)),
  });
}
