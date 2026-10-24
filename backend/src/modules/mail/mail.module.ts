import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { NodemailerMailAdapter } from '../../adapters/mail/nodemailer-mail.adapter';
import { MAIL_ADAPTER } from './mail.constants';

/**
 * Configura el transporte SMTP leyendo MAIL_* del entorno (025-player-price-alerts,
 * research.md §3). Nunca hardcodea credenciales.
 */
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST', 'localhost'),
          port: Number(config.get<string>('MAIL_PORT', '1025')),
          secure: false,
          auth: {
            user: config.get<string>('MAIL_USER', ''),
            pass: config.get<string>('MAIL_PASSWORD', ''),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM', 'alerts@desapp.local'),
        },
      }),
    }),
  ],
  providers: [{ provide: MAIL_ADAPTER, useClass: NodemailerMailAdapter }],
  exports: [MAIL_ADAPTER],
})
export class MailModule {}
