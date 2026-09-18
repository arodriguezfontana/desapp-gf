import { ValidationError } from 'class-validator';
import { translateValidationErrors } from './spanish-validation-messages';

const error = (
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError =>
  ({ property, constraints, children }) as unknown as ValidationError;

describe('translateValidationErrors', () => {
  it('traduce isEmail al español, sin usar el texto default en inglés', () => {
    const messages = translateValidationErrors([
      error('email', { isEmail: 'email must be an email' }),
    ]);

    expect(messages).toEqual(["El campo 'email' debe ser un email válido."]);
  });

  it('traduce isNotEmpty, isString e isInt', () => {
    const messages = translateValidationErrors([
      error('password', { isNotEmpty: 'password should not be empty' }),
      error('password', { isString: 'password must be a string' }),
      error('page', { isInt: 'page must be an integer number' }),
    ]);

    expect(messages).toEqual([
      "El campo 'password' no puede estar vacío.",
      "El campo 'password' debe ser de tipo texto.",
      "El campo 'page' debe ser un número entero.",
    ]);
  });

  it('extrae el número del mensaje default para min/max/maxLength', () => {
    const messages = translateValidationErrors([
      error('pageSize', { max: 'pageSize must not be greater than 50' }),
      error('page', { min: 'page must not be less than 1' }),
      error('password', {
        maxLength: 'password must be shorter than or equal to 72 characters',
      }),
    ]);

    expect(messages).toEqual([
      "El campo 'pageSize' debe ser menor o igual a 50.",
      "El campo 'page' debe ser mayor o igual a 1.",
      "El campo 'password' no puede tener más de 72 caracteres.",
    ]);
  });

  it('traduce el rechazo por whitelist (propiedad no declarada en el DTO)', () => {
    const messages = translateValidationErrors([
      error('liga', { whitelistValidation: 'property liga should not exist' }),
    ]);

    expect(messages).toEqual([
      "La propiedad 'liga' no está permitida en la solicitud.",
    ]);
  });

  it('usa un mensaje genérico en español para un constraint no mapeado (nunca en inglés)', () => {
    const messages = translateValidationErrors([
      error('campoRaro', { unaRestriccionInventada: 'some english default' }),
    ]);

    expect(messages).toEqual(["El campo 'campoRaro' es inválido."]);
  });

  it('recorre errores anidados (children)', () => {
    const messages = translateValidationErrors([
      error('padre', {}, [error('hijo', { isString: 'hijo must be a string' })]),
    ]);

    expect(messages).toEqual(["El campo 'hijo' debe ser de tipo texto."]);
  });

  it('devuelve varios mensajes cuando un mismo campo incumple más de un constraint', () => {
    const messages = translateValidationErrors([
      error('email', {
        isEmail: 'email must be an email',
        isNotEmpty: 'email should not be empty',
      }),
    ]);

    expect(messages).toEqual([
      "El campo 'email' debe ser un email válido.",
      "El campo 'email' no puede estar vacío.",
    ]);
  });
});
