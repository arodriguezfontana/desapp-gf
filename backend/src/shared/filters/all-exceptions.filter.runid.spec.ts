import { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';
import { ApiKeyAlreadyRevokedError } from '../../domain/api-key/errors/api-key-already-revoked.error';
import { SYNC_IN_PROGRESS_MESSAGE } from '../errors/messages';

describe('AllExceptionsFilter: SyncInProgressException (spec 009, FR-015)', () => {
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
        getRequest: () => ({ url: '/sync/whoscored', method: 'POST' }),
      }),
    } as unknown as ArgumentsHost;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const lastBody = () => jsonMock.mock.calls[0][0];

  it('responde 409 con el mensaje de sincronización en curso', () => {
    filter.catch(new SyncInProgressError('run-en-curso'), host);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(lastBody()).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: SYNC_IN_PROGRESS_MESSAGE,
    });
  });

  it('incluye el runId en el body cuando el error lo trae', () => {
    filter.catch(new SyncInProgressError('run-en-curso'), host);

    expect(lastBody().runId).toBe('run-en-curso');
  });

  it('no agrega la clave runId cuando el error no lo trae (Football-Data)', () => {
    filter.catch(new SyncInProgressError(), host);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(lastBody()).not.toHaveProperty('runId');
  });

  it('no altera el cuerpo de una excepción existente: un 409 de ApiKey revocada sigue sin runId', () => {
    filter.catch(new ApiKeyAlreadyRevokedError(), host);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(lastBody()).not.toHaveProperty('runId');
  });
});
