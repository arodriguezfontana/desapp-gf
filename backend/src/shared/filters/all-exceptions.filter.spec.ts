import { ArgumentsHost, BadRequestException, HttpException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { EmailAlreadyInUseError } from '../../modules/auth/domain/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../modules/auth/domain/errors/invalid-credentials.error';
import { InvalidEmailError } from '../../modules/auth/domain/errors/invalid-email.error';
import { InvalidPasswordError } from '../../modules/auth/domain/errors/invalid-password.error';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url: '/auth/login', method: 'POST' }),
      }),
    } as unknown as ArgumentsHost;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const lastBody = () => jsonMock.mock.calls[0][0];

  it('mapea InvalidEmailError a 400', () => {
    filter.catch(new InvalidEmailError(), host);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(lastBody()).toMatchObject({ statusCode: 400, error: 'Bad Request' });
  });

  it('mapea InvalidPasswordError a 400', () => {
    filter.catch(new InvalidPasswordError(), host);
    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('mapea EmailAlreadyInUseError a 409', () => {
    filter.catch(new EmailAlreadyInUseError(), host);
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(lastBody()).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'El email ya está registrado.',
    });
  });

  it('mapea InvalidCredentialsError a 401 con mensaje generico', () => {
    filter.catch(new InvalidCredentialsError(), host);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(lastBody()).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Credenciales inválidas.',
    });
  });

  it('preserva el status y el array de mensajes de una BadRequestException de validacion', () => {
    filter.catch(
      new BadRequestException(['email must be an email']),
      host,
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(lastBody().message).toEqual(['email must be an email']);
  });

  it('hace passthrough de una HttpException generica', () => {
    filter.catch(new HttpException('boom', 403), host);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('convierte un Error desconocido en 500 sin exponer stack ni mensaje interno', () => {
    filter.catch(new Error('detalle interno con secreto'), host);
    expect(statusMock).toHaveBeenCalledWith(500);
    const body = lastBody();
    expect(body.message).toBe('Ocurrió un error inesperado.');
    expect(JSON.stringify(body)).not.toContain('secreto');
    expect(body).not.toHaveProperty('stack');
  });

  it('incluye timestamp y path en el cuerpo', () => {
    filter.catch(new InvalidEmailError(), host);
    const body = lastBody();
    expect(body.path).toBe('/auth/login');
    expect(typeof body.timestamp).toBe('string');
  });
});
