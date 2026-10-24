import { randomUUID } from 'node:crypto';
import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { AlertTriggeredEvent } from '../../../domain/alerts/events/alert-triggered.event';
import { Email } from '../../../domain/auth/email';
import { User } from '../../../domain/auth/user';
import { MailAdapter } from '../../../adapters/mail/mail.adapter';
import { UserRepository } from '../../../repositories/auth/user.repository';
import { AlertMailListener } from '../alert-mail.listener';

describe('AlertMailListener (unit, con dobles, sin Nest ni DB)', () => {
  let mail: jest.Mocked<MailAdapter>;
  let users: jest.Mocked<UserRepository>;
  let listener: AlertMailListener;
  const userId = randomUUID();

  const makeUser = () => User.register(userId, Email.create('user@test.local'), 'hash', new Date());

  beforeEach(() => {
    mail = { sendAlertTriggeredMail: jest.fn().mockResolvedValue(undefined) };
    users = {
      findByEmail: jest.fn(),
      existsByEmail: jest.fn(),
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(makeUser()),
      existsByUsername: jest.fn(),
    };
    listener = new AlertMailListener(mail, users);
  });

  const makeEvent = () =>
    new AlertTriggeredEvent(randomUUID(), userId, randomUUID(), AlertCondition.PRICE_BELOW, 9.5, new Date());

  it('arma el payload desde el AlertTriggeredEvent y llama a MailAdapter con el email del usuario', async () => {
    const event = makeEvent();

    await listener.handle(event);

    expect(mail.sendAlertTriggeredMail).toHaveBeenCalledWith(
      'user@test.local',
      expect.objectContaining({
        playerId: event.playerId,
        condition: event.condition,
        triggeredValue: event.triggeredValue,
      }),
    );
  });

  it('captura y loguea una excepción del adapter sin relanzarla (FR-020)', async () => {
    mail.sendAlertTriggeredMail.mockRejectedValue(new Error('SMTP caído'));

    await expect(listener.handle(makeEvent())).resolves.toBeUndefined();
  });

  it('no llama al mail adapter si el usuario ya no existe', async () => {
    users.findById.mockResolvedValue(null);

    await listener.handle(makeEvent());

    expect(mail.sendAlertTriggeredMail).not.toHaveBeenCalled();
  });
});
