import { AlertCondition } from './alert-condition';

/** Etiqueta en español de cada condición, para mensajes de usuario (notificaciones). */
export function alertConditionLabel(condition: AlertCondition): string {
  return condition === AlertCondition.PRICE_BELOW ? 'el precio bajó de' : 'el precio subió de';
}
