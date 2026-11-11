import { BadRequestException, CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { InsufficientHoldingError } from '../../../domain/portfolio/errors/insufficient-holding.error';
import { AuditedOperation, AuditRequest } from './audited-operation.decorator';
import { BusinessAuditInterceptor } from './business-audit.interceptor';
import { RequestValidationException } from './request-validation.exception';

/** 028-US5: el interceptor registra operación, actor y resultado sin tocar el resultado de la operación. */
describe('BusinessAuditInterceptor', () => {
  class Demo {
    @AuditedOperation('ALERT_CREATED')
    audited(): void {}

    @AuditedOperation('QUOTES_RECALCULATED', { actor: 'system' })
    system(): void {}

    @AuditedOperation((req: AuditRequest) => ((req.body as { side?: string })?.side === 'BUY' ? 'TOKENS_BOUGHT' : 'TOKENS_SOLD'))
    byBody(): void {}

    notAudited(): void {}
  }

  const contextFor = (handler: () => void, req: AuditRequest, type = 'http'): ExecutionContext =>
    ({
      getType: () => type,
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  const nextOf = (result: ReturnType<CallHandler['handle']>): CallHandler => ({ handle: () => result });

  let interceptor: BusinessAuditInterceptor;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new BusinessAuditInterceptor();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const run = (handler: () => void, req: AuditRequest, result: ReturnType<CallHandler['handle']>) =>
    lastValueFrom(interceptor.intercept(contextFor(handler, req), nextOf(result)));

  it('un handler sin metadatos pasa de largo sin registrar nada', async () => {
    const value = await run(Demo.prototype.notAudited, {}, of('ok'));

    expect(value).toBe('ok');
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('un contexto que no es HTTP pasa de largo', async () => {
    const value = await lastValueFrom(
      interceptor.intercept(contextFor(Demo.prototype.audited, {}, 'rpc'), nextOf(of('ok'))),
    );

    expect(value).toBe('ok');
    expect(log).not.toHaveBeenCalled();
  });

  it('éxito: registra una línea info con event, operación, actor y outcome success', async () => {
    const value = await run(Demo.prototype.audited, { user: { userId: 'user-1' } }, of({ id: 1 }));

    expect(value).toEqual({ id: 1 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      msg: 'operación de negocio',
      event: 'business_audit',
      operation: 'ALERT_CREATED',
      actor: 'user-1',
      outcome: 'success',
    });
  });

  it('un DomainError es un fallo "rejected" a nivel warn, y se relanza el mismo error', async () => {
    const failure = new InsufficientHoldingError();

    await expect(run(Demo.prototype.audited, { user: { userId: 'user-1' } }, throwError(() => failure))).rejects.toBe(failure);

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'ALERT_CREATED', actor: 'user-1', outcome: 'failure', failureCategory: 'rejected' }),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('un error inesperado es un fallo "unexpected" a nivel error, y se relanza el mismo error', async () => {
    const failure = new Error('boom');

    await expect(run(Demo.prototype.audited, { user: { userId: 'u' } }, throwError(() => failure))).rejects.toBe(failure);

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failure', failureCategory: 'unexpected' }));
  });

  it('una RequestValidationException no registra nada (la operación nunca se ejecutó) y se relanza', async () => {
    const failure = new RequestValidationException('dto inválido');

    await expect(run(Demo.prototype.audited, { user: { userId: 'u' } }, throwError(() => failure))).rejects.toBe(failure);

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('un BadRequestException común (de un service) sí se registra como rechazo', async () => {
    await expect(
      run(Demo.prototype.audited, { user: { userId: 'u' } }, throwError(() => new BadRequestException('regla'))),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ failureCategory: 'rejected' }));
  });

  it('la línea no incluye método, ruta, parámetros, cuerpo, status, duración ni stack', async () => {
    const req = { user: { userId: 'u' }, body: { password: 'secreta' }, method: 'POST', url: '/orders' } as AuditRequest;

    await run(Demo.prototype.audited, req, of('ok'));

    const keys = Object.keys(log.mock.calls[0][0] as object).sort();
    expect(keys).toEqual(['actor', 'event', 'msg', 'operation', 'outcome']);
    expect(JSON.stringify(log.mock.calls[0][0])).not.toContain('secreta');
  });

  it('una operación de sistema sin usuario se registra con actor "sistema"', async () => {
    await run(Demo.prototype.system, {}, of('ok'));

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ operation: 'QUOTES_RECALCULATED', actor: 'sistema' }));
  });

  it('una operación declarada como función se resuelve contra la request', async () => {
    await run(Demo.prototype.byBody, { user: { userId: 'u' }, body: { side: 'BUY' } }, of('ok'));
    await run(Demo.prototype.byBody, { user: { userId: 'u' }, body: { side: 'SELL' } }, of('ok'));

    expect(log.mock.calls.map((c) => (c[0] as { operation: string }).operation)).toEqual(['TOKENS_BOUGHT', 'TOKENS_SOLD']);
  });

  it('un logger que lanza no altera el valor devuelto (FR-025)', async () => {
    log.mockImplementation(() => {
      throw new Error('logger roto');
    });

    await expect(run(Demo.prototype.audited, { user: { userId: 'u' } }, of('ok'))).resolves.toBe('ok');
  });

  it('un logger que lanza no cambia el error relanzado (FR-025)', async () => {
    warn.mockImplementation(() => {
      throw new Error('logger roto');
    });
    const failure = new InsufficientHoldingError();

    await expect(run(Demo.prototype.audited, { user: { userId: 'u' } }, throwError(() => failure))).rejects.toBe(failure);
  });

  it('una función de operación que lanza no altera el resultado', async () => {
    class Broken {
      @AuditedOperation(() => {
        throw new Error('resolver roto');
      })
      handler(): void {}
    }

    await expect(run(Broken.prototype.handler, {}, of('ok'))).resolves.toBe('ok');
    expect(log).not.toHaveBeenCalled();
  });
});
