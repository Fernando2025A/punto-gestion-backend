import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  async sendEmail(to: string) {
    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: 'Bienvenido a UniSite',
      html: '<h1>Gracias por registrarte</h1> <p>Para disfrutar todas las características de la app, por favor, verifica tu email.</p> <p>Si no fuiste tú quien se registró en UniSite, ignora este mensaje.</p>',
    });
  }
  async sendCode(to: string, code: string) {
    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: 'Bienvenido a UniSite',
      html: `<h1>Verificación de email</h1> <p>Tu código de verificación es: ${code}</p>`,
    });
  }
}
