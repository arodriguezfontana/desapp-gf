import { ValidationPipe } from '@nestjs/common';
import { RequestValidationException } from '../observability/business-audit/request-validation.exception';
import { translateValidationErrors } from './spanish-validation-messages';

/**
 * Único punto donde se configura el `ValidationPipe` global de la app, para que
 * `main.ts` (runtime real) y `test/test-app.ts` (e2e) usen exactamente la misma
 * configuración — incluida la traducción de mensajes a español.
 *
 * Lanza `RequestValidationException` (un `BadRequestException`: mismo status, mensaje y formato) para que la
 * auditoría de negocio distinga una validación fallida de un 400 de un service (spec 028, US5).
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new RequestValidationException(translateValidationErrors(errors)),
  });
}
