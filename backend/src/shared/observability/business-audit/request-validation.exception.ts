import { BadRequestException } from '@nestjs/common';

/**
 * Error de validación del cuerpo/parámetros de una request (lo lanza el `ValidationPipe` global).
 * Es un `BadRequestException` común para el resto del sistema —mismo status, mismo mensaje y mismo
 * formato de error—; existe sólo para que el `BusinessAuditInterceptor` pueda distinguirlo de un 400
 * lanzado por un service. Los pipes corren después de los interceptores, así que sin esto una
 * validación de DTO fallida se vería como una operación de negocio rechazada, cuando en realidad la
 * operación nunca llegó a ejecutarse (spec 028, FR-024).
 */
export class RequestValidationException extends BadRequestException {}
