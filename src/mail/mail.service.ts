import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

export interface PlanUpgradeNotificationParams {
  requestId: number;
  businessId: number;
  businessName: string;
  userEmail: string;
  planName: string;
  amount: number | string;
  alias: string;
  comment?: string;
}

@Injectable()
export class MailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  async sendEmail(to: string) {
    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: 'Bienvenido a Punto gestión',
      html: '<h1>¡Gracias por registrarte!</h1> <p>En <strong>Punto Gestión</strong>, tienes múltiples herramientas que te permitirán llevar la gestión de tu negocio a otro nivel. Ya puedes disfrutar de: acceso remoto desde cualquier dispositivo, hasta 30 productos, 2 empleados, 500 movimientos mensuales, reportes en tiempo real, ¡y más!. Puedes consultar la sección <strong>Configuración -> Suscripciones</strong> para ver planes con límites mayores y más características.</p> <p>Puedes enviar tus comentarios a <strong>ferdevx.pg@gmail.com</strong></p>',
    });
  }

  async sendCode(to: string, code: string) {
    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: 'Completar registro en Punto Gestión',
      html: `<h1>Verifica tu email</h1> <p>Tu código de verificación es: <strong>${code}</strong>.</p> <p>No lo compartas con nadie</p>`,
    });
  }

  async sendPlanUpgradeRequestNotification(
    data: PlanUpgradeNotificationParams,
  ) {
    const adminEmail =
      process.env.ADMIN_EMAILS?.split(',')[0] || process.env.EMAIL_FROM!;

    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: adminEmail,
      subject: `[Punto Gestión] Solicitud de Plan: ${data.businessName}`,
      html: `
        <h2>Nueva Solicitud de Upgrade de Plan</h2>
        <p>Se ha registrado un nuevo comprobante/pago por transferencia para revisar:</p>
        <ul>
          <li><strong>ID Solicitud:</strong> ${data.requestId}</li>
          <li><strong>Negocio:</strong> ${data.businessName} (ID: ${data.businessId})</li>
          <li><strong>Usuario solicitante:</strong> ${data.userEmail}</li>
          <li><strong>Plan solicitado:</strong> ${data.planName}</li>
          <li><strong>Monto a verificar:</strong> $${data.amount}</li>
          <li><strong>Alias informado:</strong> <code>${data.alias}</code></li>
          <li><strong>Comentario:</strong> ${data.comment || 'Sin comentarios'}</li>
        </ul>
        <p>Una vez verificada la acreditación en tu cuenta, aprueba la solicitud desde el panel/endpoint correspondiente.</p>
      `,
    });
  }

  async sendPlanUpgradedNotification(
    to: string,
    businessName: string,
    planName: string,
    expiresAt: Date,
  ) {
    const formattedDate = expiresAt.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: `¡Plan actualizado para ${businessName}! - Punto Gestión`,
      html: `
      <h1>¡Tu plan ha sido actualizado con éxito!</h1>
      <p>Hola, queremos informarte que el plan de tu negocio <strong>${businessName}</strong> ha sido actualizado a <strong>${planName}</strong>.</p>
      <p>Tu suscripción estará activa hasta el <strong>${formattedDate}</strong>.</p>
      <p>Ya puedes disfrutar de todos los beneficios y nuevos límites accediendo a tu panel.</p>
      <p>Gracias por confiar en <strong>Punto Gestión</strong>.</p>
    `,
    });
  }

  async sendPasswordResetCode(to: string, code: string) {
    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: 'Restablecer contraseña - Punto Gestión',
      html: `
      <h1>Recuperación de Contraseña</h1>
      <p>Has solicitado restablecer la contraseña de tu cuenta en <strong>Punto Gestión</strong>.</p>
      <p>Tu código de verificación es: <strong>${code}</strong></p>
      <p>Este código vencerá en <strong>15 minutos</strong>.</p>
      <p>Si no solicitaste este cambio, puedes ignorar este mensaje y tu contraseña permanecerá sin cambios.</p>
    `,
    });
  }

  async sendSessionCode(to: string, code: string) {
    return this.resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: 'Código de verificación - Punto Gestión',
      html: `
      <h1>Completar inicio de sesión</h1>

      <p>
        Estás intentando iniciar sesión en <strong>Punto Gestión</strong>.
      </p>

      <p>
        Tu código de verificación es:
        <strong>${code}</strong>
      </p>

      <p>
        Este código vencerá en <strong>5 minutos</strong>.
      </p>

      <p>
        Si no has intentado iniciar sesión, puedes ignorar este correo.
        Tu cuenta permanecerá protegida mientras no compartas este código.
      </p>
    `,
    });
  }
}
