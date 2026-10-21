import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends transactional email over SMTP, so any provider works by changing env vars only:
 *   SMTP_HOST, SMTP_PORT (465 = TLS), SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_REPLY_TO (optional).
 * Resend: SMTP_HOST=smtp.resend.com, SMTP_PORT=465, SMTP_USER=resend, SMTP_PASS=<API key>.
 * With no SMTP_HOST, mail isn't sent: outside production the message is logged instead (dev).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'production')
        throw new Error('Email is not configured (SMTP_HOST missing)');
      this.logger.warn(
        `[DEV MAIL — not sent] to=${message.to} subject="${message.subject}"\n${message.text}`,
      );
      return;
    }
    await this.getTransporter().sendMail({
      from:
        this.config.get<string>('MAIL_FROM') ??
        'HeroKids Universe <no-reply@herokidsuniverse.com>',
      replyTo: this.config.get<string>('MAIL_REPLY_TO') || undefined,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
    return this.transporter;
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
