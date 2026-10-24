import { DomainError } from '../../../shared/errors/domain-error';

/** 404 tanto si no existe como si no pertenece al usuario autenticado (mismo criterio que AlertNotFoundError). */
export class NotificationNotFoundError extends DomainError {
  constructor() {
    super('No se encontró la notificación solicitada.');
  }
}
