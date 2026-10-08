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
import { EmailAlreadyInUseError } from '../../domain/auth/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../domain/auth/errors/invalid-credentials.error';
import { InvalidEmailError } from '../../domain/auth/errors/invalid-email.error';
import { InvalidPasswordError } from '../../domain/auth/errors/invalid-password.error';
import { ApiKeyAlreadyRevokedError } from '../../domain/api-key/errors/api-key-already-revoked.error';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';
import { InvalidStrategyWeightsError } from '../../domain/quotation/errors/invalid-strategy-weights.error';
import { NoActiveStrategyError } from '../../domain/quotation/errors/no-active-strategy.error';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  /** Solo en el 409 de sincronización cuando la feature tiene estado de corrida (spec 009, FR-015). */
  runId?: string;
}

const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
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

    const { status, message, runId } = this.resolve(exception);
    const body: ErrorBody = {
      statusCode: status,
      error: REASON_PHRASES[status] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(runId !== undefined && { runId }),
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
    runId?: string;
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

    if (exception instanceof PlayerNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: exception.message };
    }

    if (
      exception instanceof EmailAlreadyInUseError ||
      exception instanceof ApiKeyAlreadyRevokedError
    ) {
      return { status: HttpStatus.CONFLICT, message: exception.message };
    }

    if (exception instanceof SyncInProgressError) {
      return {
        status: HttpStatus.CONFLICT,
        message: exception.message,
        runId: exception.runId,
      };
    }

    if (exception instanceof RecalculationInProgressError) {
      return { status: HttpStatus.CONFLICT, message: exception.message };
    }

    if (
      exception instanceof InvalidStrategyWeightsError ||
      exception instanceof NoActiveStrategyError
    ) {
      return { status: HttpStatus.UNPROCESSABLE_ENTITY, message: exception.message };
    }

    if (exception instanceof StrategyNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: exception.message };
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
