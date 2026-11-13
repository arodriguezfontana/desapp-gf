import { BadRequestException, CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { InsufficientHoldingError } from '../../../domain/portfolio/errors/insufficient-holding.error';
import { AuditedOperation } from './audited-operation.decorator';
import { BusinessAuditInterceptor } from './business-audit.interceptor';
import { RequestValidationException } from './request-validation.exception';

/** 031: el contador genérico de operaciones se alimenta desde el mismo bloque protegido de la auditoría. */
describe('BusinessAuditInterceptor — métricas de negocio', () => {
  class Demo {
    @AuditedOperation('ALERT_CREATED')
    audited(): void {}

    @AuditedOperation('PLAYER_SYNC_TRIGGERED', { actor: 'system' })
    sync(): void {}

    notAudited(): void {}
  }

  const contextFor = (handler: () => void): ExecutionContext =>
    ({
      getType: () => 'http',
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    }) as unknown as ExecutionContext;

  const metrics = { recordOperation: jest.fn() };
  const run = (interceptor: BusinessAuditInterceptor, handler: () => void, result: ReturnType<CallHandler['handle']>) =>
    lastValueFrom(interceptor.intercept(contextFor(handler), { handle: () => result }));

  beforeEach(() => {
    metrics.recordOperation.mockReset();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const build = () => new BusinessAuditInterceptor(metrics as never);

  it('éxito: cuenta la operación como success', async () => {
    await run(build(), Demo.prototype.audited, of('ok'));
    expect(metrics.recordOperation).toHaveBeenCalledTimes(1);
    expect(metrics.recordOperation).toHaveBeenCalledWith('ALERT_CREATED', 'success');
  });

  it('un DomainError cuenta como rejected', async () => {
    await expect(run(build(), Demo.prototype.audited, throwError(() => new InsufficientHoldingError()))).rejects.toBeInstanceOf(
      InsufficientHoldingError,
    );
    expect(metrics.recordOperation).toHaveBeenCalledWith('ALERT_CREATED', 'rejected');
  });

  it('un HttpException 4xx cuenta como rejected', async () => {
    await expect(run(build(), Demo.prototype.audited, throwError(() => new BadRequestException('x')))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(metrics.recordOperation).toHaveBeenCalledWith('ALERT_CREATED', 'rejected');
  });

  it('un error común cuenta como unexpected', async () => {
    await expect(run(build(), Demo.prototype.audited, throwError(() => new Error('boom')))).rejects.toThrow('boom');
    expect(metrics.recordOperation).toHaveBeenCalledWith('ALERT_CREATED', 'unexpected');
  });

  it('una validación de DTO fallida (RequestValidationException) no cuenta', async () => {
    await expect(
      run(build(), Demo.prototype.audited, throwError(() => new RequestValidationException('inválido'))),
    ).rejects.toBeInstanceOf(RequestValidationException);
    expect(metrics.recordOperation).not.toHaveBeenCalled();
  });

  it('un handler sin @AuditedOperation no cuenta', async () => {
    await run(build(), Demo.prototype.notAudited, of('ok'));
    expect(metrics.recordOperation).not.toHaveBeenCalled();
  });

  it('PLAYER_SYNC_TRIGGERED exitoso se cuenta como success (corrida aceptada)', async () => {
    await run(build(), Demo.prototype.sync, of({ runId: 'r1' }));
    expect(metrics.recordOperation).toHaveBeenCalledWith('PLAYER_SYNC_TRIGGERED', 'success');
  });

  it('un BusinessMetrics que lanza no altera la respuesta ni el error relanzado', async () => {
    metrics.recordOperation.mockImplementation(() => {
      throw new Error('métricas rotas');
    });
    await expect(run(build(), Demo.prototype.audited, of('ok'))).resolves.toBe('ok');
    await expect(run(build(), Demo.prototype.audited, throwError(() => new Error('boom')))).rejects.toThrow('boom');
  });

  it('sin BusinessMetrics inyectado funciona igual', async () => {
    await expect(run(new BusinessAuditInterceptor(), Demo.prototype.audited, of('ok'))).resolves.toBe('ok');
  });
});
