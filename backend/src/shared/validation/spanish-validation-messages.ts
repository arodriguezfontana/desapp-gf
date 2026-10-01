import { ValidationError } from 'class-validator';

/**
 * Traductor único y global de mensajes de validación (constitución, Principio XI:
 * los mensajes de error MUST estar en español, sin excepción). `class-validator`
 * sólo trae mensajes default en inglés; en vez de agregar un `message` en español
 * a cada decorador de cada DTO, este módulo traduce cualquier `ValidationError`
 * a partir del **nombre del constraint** (`isEmail`, `maxLength`, `whitelistValidation`,
 * etc. — estable e independiente del idioma), no del texto del mensaje default.
 *
 * Cualquier constraint no mapeado explícitamente cae en `DEFAULT_MESSAGE`, así que
 * nunca se filtra un mensaje en inglés aunque se agregue un decorador nuevo sin
 * actualizar este diccionario.
 */
type MessageBuilder = (property: string, args: number[]) => string;

const extractNumbers = (defaultMessage: string): number[] =>
  (defaultMessage.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

const MESSAGE_BUILDERS: Record<string, MessageBuilder> = {
  isEmail: (property) => `El campo '${property}' debe ser un email válido.`,
  isString: (property) => `El campo '${property}' debe ser de tipo texto.`,
  isNotEmpty: (property) => `El campo '${property}' no puede estar vacío.`,
  isInt: (property) => `El campo '${property}' debe ser un número entero.`,
  isNumber: (property) => `El campo '${property}' debe ser un número.`,
  isBoolean: (property) =>
    `El campo '${property}' debe ser verdadero o falso.`,
  isEnum: (property) =>
    `El campo '${property}' tiene un valor no permitido.`,
  isUuid: (property) =>
    `El campo '${property}' debe ser un identificador válido.`,
  isArray: (property) => `El campo '${property}' debe ser una lista.`,
  arrayNotEmpty: (property) =>
    `El campo '${property}' no puede ser una lista vacía.`,
  min: (property, [value]) =>
    `El campo '${property}' debe ser mayor o igual a ${value}.`,
  max: (property, [value]) =>
    `El campo '${property}' debe ser menor o igual a ${value}.`,
  minLength: (property, [value]) =>
    `El campo '${property}' debe tener al menos ${value} caracteres.`,
  maxLength: (property, [value]) =>
    `El campo '${property}' no puede tener más de ${value} caracteres.`,
  whitelistValidation: (property) =>
    `La propiedad '${property}' no está permitida en la solicitud.`,
};

const DEFAULT_MESSAGE: MessageBuilder = (property) =>
  `El campo '${property}' es inválido.`;

function translateConstraint(
  property: string,
  constraintType: string,
  defaultMessage: string,
): string {
  const build = MESSAGE_BUILDERS[constraintType] ?? DEFAULT_MESSAGE;
  return build(property, extractNumbers(defaultMessage));
}

/**
 * Convierte el árbol de `ValidationError` que arma `class-validator` en un array
 * plano de mensajes en español, recorriendo también los errores anidados
 * (`error.children`) si algún DTO futuro los tuviera.
 */
export function translateValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  const visit = (error: ValidationError): void => {
    if (error.constraints) {
      for (const [type, defaultMessage] of Object.entries(error.constraints)) {
        messages.push(translateConstraint(error.property, type, defaultMessage));
      }
    }
    error.children?.forEach(visit);
  };

  errors.forEach(visit);
  return messages;
}
