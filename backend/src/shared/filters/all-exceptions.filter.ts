import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../errors/domain-error';
import { EmailAlreadyInUseError } from '../../modules/auth/domain/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../modules/auth/domain/errors/invalid-credentials.error';
import { InvalidEmailError } from '../../modules/auth/domain/errors/invalid-email.error';
import { InvalidPasswordError } from '../../modules/auth/domain/errors/invalid-password.error';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/**
 * Filtro global unico (constitucion, Principio III). Devuelve siempre el mismo
 * formato JSON de error con el status correcto y sin filtrar stack traces ni
 * mensajes internos. Nunca loguea el body de la request (Principio IV).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);
    const body: ErrorBody = {
      statusCode: status,
      error: REASON_PHRASES[status] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}`);
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
  } {
    if (
      exception instanceof InvalidEmailError ||
      exception instanceof InvalidPasswordError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: exception.message };
    }

    if (exception instanceof InvalidCredentialsError) {
      return { status: HttpStatus.UNAUTHORIZED, message: exception.message };
    }

    if (exception instanceof EmailAlreadyInUseError) {
      return { status: HttpStatus.CONFLICT, message: exception.message };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);
      return { status, message };
    }

    if (exception instanceof DomainError) {
      // Cualquier DomainError no mapeado explicitamente: 400 con su mensaje (ya en español).
      return { status: HttpStatus.BAD_REQUEST, message: exception.message };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Ocurrió un error inesperado.',
    };
  }
}
