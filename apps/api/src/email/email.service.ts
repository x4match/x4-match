import { Injectable, Logger } from '@nestjs/common';
import { EmailTemplate, renderEmail, EmailTemplateData } from './email.templates';

type SendParams = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private get apiKey() {
    return process.env.RESEND_API_KEY?.trim() || '';
  }

  private get from() {
    return process.env.EMAIL_FROM?.trim() || 'x4 match <no-reply@x4match.com>';
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  /** Emails del equipo x4 match que reciben alertas internas (coma separada). */
  get adminRecipients(): string[] {
    return (process.env.EMAIL_ADMIN_NOTIFY ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  /** Nunca lanza: un email fallido no debe romper el flujo que lo dispara. */
  async sendTemplate<T extends EmailTemplate>(
    to: string | string[],
    template: T,
    data: EmailTemplateData<T>,
  ): Promise<boolean> {
    const rendered = renderEmail(template, data);
    return this.send({ to, ...rendered });
  }

  /** Para disparar sin bloquear la respuesta HTTP. */
  queueTemplate<T extends EmailTemplate>(
    to: string | string[],
    template: T,
    data: EmailTemplateData<T>,
  ): void {
    void this.sendTemplate(to, template, data);
  }

  async send(params: SendParams): Promise<boolean> {
    const recipients = (Array.isArray(params.to) ? params.to : [params.to]).filter(Boolean);
    if (recipients.length === 0) return false;

    if (!this.isConfigured) {
      this.logger.log(
        `[email deshabilitado] to=${recipients.join(',')} subject="${params.subject}"\n${params.text}`,
      );
      return false;
    }

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: recipients,
          subject: params.subject,
          html: params.html,
          text: params.text,
          ...(params.replyTo || process.env.EMAIL_REPLY_TO
            ? { reply_to: params.replyTo || process.env.EMAIL_REPLY_TO }
            : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Resend HTTP ${res.status} subject="${params.subject}": ${body}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Email no enviado (${params.subject}): ${(error as Error).message}`);
      return false;
    }
  }
}
