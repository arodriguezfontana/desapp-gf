import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Se lanza tanto si la alerta no existe como si existe pero no pertenece al
 * usuario autenticado: 404 en ambos casos para no revelar la existencia de
 * alertas ajenas (contracts/alerts-api.md).
 */
export class AlertNotFoundError extends DomainError {
  constructor() {
    super('No se encontró la alerta solicitada.');
  }
}
