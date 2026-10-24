import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Se lanza al intentar crear una alerta idéntica (mismo jugador, condición
 * y umbral) a una que el usuario ya tiene activa (spec FR-003: no hay
 * restricción de unicidad entre alertas DISTINTAS, pero una duplicada no
 * aporta nada y confunde al usuario).
 */
export class DuplicateAlertError extends DomainError {
  constructor() {
    super('Ya tenés una alerta activa idéntica (mismo jugador, condición y valor umbral).');
  }
}
