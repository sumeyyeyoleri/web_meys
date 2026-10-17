import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../config/env';
import { describeError, logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  /** True when SMTP credentials are configured. */
  readonly configured: boolean;
  /** Returns true only if the SMTP server accepted the message. Never throws. */
  send(message: MailMessage): Promise<boolean>;
}

class SmtpMailer implements Mailer {
  readonly configured = true;
  private readonly transporter: Transporter;

  constructor(private readonly smtp: NonNullable<AppConfig['smtp']>) {
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password ?? '' } : undefined,
    });
  }

  async send(message: MailMessage): Promise<boolean> {
    try {
      await this.transporter.sendMail({ from: this.smtp.from, ...message });
      return true;
    } catch (error) {
      logger.error('Email delivery failed', describeError(error));
      return false;
    }
  }
}

class DisabledMailer implements Mailer {
  readonly configured = false;
  async send(): Promise<boolean> {
    return false;
  }
}

export function createMailer(smtp: AppConfig['smtp']): Mailer {
  return smtp ? new SmtpMailer(smtp) : new DisabledMailer();
}
