import { Controller, Post } from '@nestjs/common';
import { AuditedOperation, getAuditedOperation, resolveOperation } from './audited-operation.decorator';

describe('@AuditedOperation', () => {
  @Controller('demo')
  class DemoController {
    @Post('a')
    @AuditedOperation('ALERT_CREATED')
    plain(): void {}

    @Post('b')
    @AuditedOperation('QUOTES_RECALCULATED', { actor: 'system' })
    system(): void {}

    @Post('c')
    @AuditedOperation((req) => ((req.body as { side?: string })?.side === 'BUY' ? 'TOKENS_BOUGHT' : 'TOKENS_SOLD'))
    byBody(): void {}

    @Post('d')
    notAudited(): void {}
  }

  it('guarda la operación y el actor por defecto ("user") en los metadatos del handler', () => {
    expect(getAuditedOperation(DemoController.prototype.plain)).toEqual({ operation: 'ALERT_CREATED', actor: 'user' });
  });

  it('con { actor: "system" } guarda el actor de sistema', () => {
    expect(getAuditedOperation(DemoController.prototype.system)?.actor).toBe('system');
  });

  it('un handler sin el decorator no tiene declaración', () => {
    expect(getAuditedOperation(DemoController.prototype.notAudited)).toBeUndefined();
  });

  describe('resolveOperation', () => {
    it('devuelve el literal declarado', () => {
      const metadata = getAuditedOperation(DemoController.prototype.plain)!;

      expect(resolveOperation(metadata, {})).toBe('ALERT_CREATED');
    });

    it('evalúa la función contra la request', () => {
      const metadata = getAuditedOperation(DemoController.prototype.byBody)!;

      expect(resolveOperation(metadata, { body: { side: 'BUY' } })).toBe('TOKENS_BOUGHT');
      expect(resolveOperation(metadata, { body: { side: 'SELL' } })).toBe('TOKENS_SOLD');
    });
  });
});
