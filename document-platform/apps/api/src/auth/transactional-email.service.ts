import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TransactionalEmailService {
  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    if (!this.config.get<string>('RESEND_API_KEY')) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.',
      );
    }
  }

  async sendPasswordReset(email: string, token: string) {
    const url = `${this.webUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      email,
      'Reset your AppToolkitLab password',
      `Open this secure link to reset your password (valid for one hour):\n\n${url}`,
    );
  }

  async sendEmailVerification(email: string, token: string) {
    const url = `${this.webUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      email,
      'Verify your AppToolkitLab email',
      `Verify your AppToolkitLab email address using this link (valid for 24 hours):\n\n${url}`,
    );
  }

  isConfigured() {
    return Boolean(this.config.get<string>('RESEND_API_KEY'));
  }

  /** Plain business notification (reminders, alerts). */
  async sendText(to: string, subject: string, text: string) {
    await this.send(to, subject.slice(0, 200), text);
  }

  /** Business email with one file attached (e.g. an invoice PDF). */
  async sendWithAttachment(
    to: string,
    subject: string,
    text: string,
    attachment: { filename: string; content: Buffer },
  ) {
    await this.send(to, subject.slice(0, 200), text, [
      { filename: attachment.filename, content: attachment.content.toString('base64') },
    ]);
  }

  webUrl() {
    return this.config.get<string>('PUBLIC_WEB_URL', 'http://localhost:5173').replace(/\/$/, '');
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    attachments?: Array<{ filename: string; content: string }>,
  ) {
    this.assertConfigured();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get<string>('EMAIL_FROM', 'AppToolkitLab <onboarding@resend.dev>'),
        to: [to],
        subject,
        text,
        ...(attachments ? { attachments } : {}),
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException('Email delivery failed. Please try again later.');
    }
  }
}
