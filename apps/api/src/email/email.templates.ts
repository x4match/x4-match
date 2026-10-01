type TemplateMap = {
  emailVerificationCode: { name: string; code: string; expiresInMinutes: number };
  welcomePlayer: { name: string };
  clubRegistrationReceived: { name: string };
  clubRegistrationAdminAlert: { name: string; email: string };
  clubApproved: { name: string; panelUrl?: string };
  clubRejected: { name: string; notes?: string | null };
  passwordResetCode: { name: string; code: string; expiresInMinutes: number };
  passwordChanged: { name: string };
  accountDeleted: { name: string };
};

export type EmailTemplate = keyof TemplateMap;
export type EmailTemplateData<T extends EmailTemplate> = TemplateMap[T];

type Rendered = { subject: string; html: string; text: string };

const SUPPORT_EMAIL = 'soporte@x4match.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Hola';
}

function layout(params: { title: string; paragraphs: string[]; highlight?: string; cta?: { label: string; url: string } }): string {
  const body = params.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#0B1220;">${p}</p>`)
    .join('');
  const highlight = params.highlight
    ? `<div style="margin:8px 0 24px;padding:16px;border-radius:12px;background:#0B1220;color:#F5C518;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;">${params.highlight}</div>`
    : '';
  const cta = params.cta
    ? `<p style="margin:8px 0 24px;"><a href="${params.cta.url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#F5C518;color:#0B1220;font-weight:700;text-decoration:none;">${params.cta.label}</a></p>`
    : '';

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0B1220;padding:20px 24px;color:#F5C518;font-size:20px;font-weight:800;">x4 match</td></tr>
        <tr><td style="padding:28px 24px 8px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:26px;color:#0B1220;">${params.title}</h1>
          ${body}${highlight}${cta}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;font-size:12px;line-height:18px;color:#6B7280;border-top:1px solid #E5E7EB;">
          Recibiste este email porque tenés una cuenta en x4 match. ¿Dudas? Escribinos a
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#0D9488;">${SUPPORT_EMAIL}</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const renderers: { [K in EmailTemplate]: (data: TemplateMap[K]) => Rendered } = {
  emailVerificationCode: ({ name, code, expiresInMinutes }) => ({
    subject: `Tu código de verificación: ${code}`,
    html: layout({
      title: 'Verificá tu email',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, ingresá este código en x4 match para activar tu cuenta. Vence en ${expiresInMinutes} minutos.`,
        'Si no creaste una cuenta, ignorá este email.',
      ],
      highlight: escapeHtml(code),
    }),
    text: `Hola ${firstName(name)}, tu código de verificación de x4 match es ${code}. Vence en ${expiresInMinutes} minutos. Si no creaste una cuenta, ignorá este email.`,
  }),

  welcomePlayer: ({ name }) => ({
    subject: '¡Bienvenido a x4 match!',
    html: layout({
      title: `¡Bienvenido, ${escapeHtml(firstName(name))}!`,
      paragraphs: [
        'Tu cuenta ya está lista. Armá partidos, sumá puntos en el ranking de tu club y desafiá a otros jugadores.',
        'Completá tu perfil y tu disponibilidad para que te encontremos partidos a tu nivel.',
      ],
    }),
    text: `¡Bienvenido, ${firstName(name)}! Tu cuenta de x4 match ya está lista. Completá tu perfil y tu disponibilidad para encontrar partidos a tu nivel.`,
  }),

  clubRegistrationReceived: ({ name }) => ({
    subject: 'Recibimos el registro de tu club',
    html: layout({
      title: 'Registro recibido',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, recibimos el registro de tu club en x4 match.`,
        'Nuestro equipo lo va a revisar y te avisaremos por este medio cuando esté aprobado. Hasta entonces no vas a poder iniciar sesión.',
      ],
    }),
    text: `Hola ${firstName(name)}, recibimos el registro de tu club en x4 match. Te avisaremos por email cuando esté aprobado.`,
  }),

  clubRegistrationAdminAlert: ({ name, email }) => ({
    subject: `Nuevo club pendiente de verificación: ${name}`,
    html: layout({
      title: 'Nuevo club para verificar',
      paragraphs: [
        `<strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) se registró como club y está pendiente de verificación.`,
        'Revisalo desde el panel de administración.',
      ],
    }),
    text: `Nuevo club pendiente de verificación: ${name} (${email}). Revisalo desde el panel de administración.`,
  }),

  clubApproved: ({ name, panelUrl }) => ({
    subject: '¡Tu club fue aprobado en x4 match!',
    html: layout({
      title: '¡Club aprobado!',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, verificamos el registro de tu club. Ya podés iniciar sesión y empezar a cargar canchas, turnos y torneos.`,
      ],
      cta: panelUrl ? { label: 'Ir al panel del club', url: panelUrl } : undefined,
    }),
    text: `Hola ${firstName(name)}, tu club fue aprobado en x4 match. Ya podés iniciar sesión.${panelUrl ? ` Panel: ${panelUrl}` : ''}`,
  }),

  clubRejected: ({ name, notes }) => ({
    subject: 'No pudimos verificar el registro de tu club',
    html: layout({
      title: 'Registro no aprobado',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, no pudimos verificar el registro de tu club.`,
        ...(notes?.trim() ? [`Motivo: ${escapeHtml(notes.trim())}`] : []),
        `Si creés que es un error, respondé este email o escribinos a ${SUPPORT_EMAIL}.`,
      ],
    }),
    text: `Hola ${firstName(name)}, no pudimos verificar el registro de tu club.${notes?.trim() ? ` Motivo: ${notes.trim()}.` : ''} Escribinos a ${SUPPORT_EMAIL}.`,
  }),

  passwordResetCode: ({ name, code, expiresInMinutes }) => ({
    subject: `Tu código de recuperación: ${code}`,
    html: layout({
      title: 'Recuperá tu contraseña',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, usá este código en la app para crear una nueva contraseña. Vence en ${expiresInMinutes} minutos.`,
      ],
      highlight: escapeHtml(code),
    }),
    text: `Hola ${firstName(name)}, tu código de recuperación de x4 match es ${code}. Vence en ${expiresInMinutes} minutos. Si no lo pediste, ignorá este email.`,
  }),

  passwordChanged: ({ name }) => ({
    subject: 'Tu contraseña fue cambiada',
    html: layout({
      title: 'Contraseña actualizada',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, la contraseña de tu cuenta de x4 match se cambió correctamente.`,
        `Si no fuiste vos, escribinos de inmediato a ${SUPPORT_EMAIL}.`,
      ],
    }),
    text: `Hola ${firstName(name)}, la contraseña de tu cuenta de x4 match se cambió. Si no fuiste vos, escribinos a ${SUPPORT_EMAIL}.`,
  }),

  accountDeleted: ({ name }) => ({
    subject: 'Tu cuenta de x4 match fue eliminada',
    html: layout({
      title: 'Cuenta eliminada',
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, eliminamos tu cuenta y tus datos personales de x4 match.`,
        'Gracias por haber jugado con nosotros. Podés volver a registrarte cuando quieras.',
      ],
    }),
    text: `Hola ${firstName(name)}, eliminamos tu cuenta de x4 match. Gracias por haber jugado con nosotros.`,
  }),
};

export function renderEmail<T extends EmailTemplate>(template: T, data: TemplateMap[T]): Rendered {
  return renderers[template](data);
}
