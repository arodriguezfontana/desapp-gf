import { randomUUID } from 'node:crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { NodemailerMailAdapter } from './nodemailer-mail.adapter';

describe('NodemailerMailAdapter (sin conexión SMTP real)', () => {
  let mailer: jest.Mocked<Pick<MailerService, 'sendMail'>>;
  let adapter: NodemailerMailAdapter;

  beforeEach(() => {
    mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
    adapter = new NodemailerMailAdapter(mailer as unknown as MailerService);
  });

  it('arma el mail con el destinatario, asunto y el payload del disparo', async () => {
    const playerId = randomUUID();
    const occurredAt = new Date('2026-01-01T00:00:00.000Z');

    await adapter.sendAlertTriggeredMail('user@test.local', {
      playerId,
      condition: AlertCondition.PRICE_BELOW,
      triggeredValue: 9.5,
      occurredAt,
    });

    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    const [call] = mailer.sendMail.mock.calls[0] as [{ to: string; subject: string; text: string }];
    expect(call.to).toBe('user@test.local');
    expect(call.subject).toContain('alerta');
    expect(call.text).toContain(playerId);
    expect(call.text).toContain('9.5');
    expect(call.text).toContain(occurredAt.toISOString());
  });

  it('propaga una excepción del transporte sin capturarla (la captura es responsabilidad del listener, FR-020)', async () => {
    mailer.sendMail.mockRejectedValue(new Error('SMTP caído'));

    await expect(
      adapter.sendAlertTriggeredMail('user@test.local', {
        playerId: randomUUID(),
        condition: AlertCondition.PRICE_ABOVE,
        triggeredValue: 20,
        occurredAt: new Date(),
      }),
    ).rejects.toThrow('SMTP caído');
  });
});
