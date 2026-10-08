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
const SITE_URL = 'https://x4match.com';
const LOGO_URL = process.env.EMAIL_LOGO_URL?.trim() || `${SITE_URL}/email/x4match.png`;

const COLORS = {
  page: '#000000',
  card: '#111111',
  cardBorder: '#242424',
  inset: '#0A0A0A',
  lime: '#D7FF00',
  onLime: '#0A0A0A',
  text: '#FAFAFA',
  textSecondary: '#B5B5B5',
  textMuted: '#737373',
};

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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

function layout(params: {
  title: string;
  preheader: string;
  paragraphs: string[];
  highlight?: { label: string; value: string };
  cta?: { label: string; url: string };
  note?: string;
}): string {
  const c = COLORS;
  const body = params.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:25px;color:${c.textSecondary};">${p}</p>`,
    )
    .join('');
  const highlight = params.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
            <tr><td align="center" style="padding:20px 16px 22px;border-radius:16px;background:${c.inset};border:1px solid ${c.cardBorder};">
              <div style="margin:0 0 8px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${c.textMuted};">${params.highlight.label}</div>
              <div style="font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:36px;line-height:44px;font-weight:700;letter-spacing:10px;color:${c.lime};">${params.highlight.value}</div>
            </td></tr>
          </table>`
    : '';
  const cta = params.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
            <tr><td style="border-radius:999px;background:${c.lime};">
              <a href="${escapeHtml(params.cta.url)}" style="display:inline-block;padding:14px 28px;border-radius:999px;font-size:15px;line-height:20px;font-weight:700;color:${c.onLime};text-decoration:none;">${params.cta.label}</a>
            </td></tr>
          </table>`
    : '';
  const note = params.note
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${c.textMuted};">${params.note}</p>`
    : '';

  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${params.title}</title>
  <style>
    :root { color-scheme: dark; supported-color-schemes: dark; }
    a { color: ${c.lime}; }
    @media (max-width: 600px) {
      .x4-container { padding: 16px 12px 32px !important; }
      .x4-card-body { padding: 28px 22px 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${c.page};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${params.preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.page}" style="background:${c.page};">
    <tr><td align="center" class="x4-container" style="padding:32px 16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding:0 0 24px;">
          <a href="${SITE_URL}" style="text-decoration:none;">
            <img src="${LOGO_URL}" width="104" height="104" alt="x4 match" style="display:block;width:104px;height:104px;border:0;outline:none;border-radius:24px;color:${c.lime};font-size:22px;font-weight:800;">
          </a>
        </td></tr>
        <tr><td bgcolor="${c.card}" style="background:${c.card};border:1px solid ${c.cardBorder};border-radius:24px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="height:4px;line-height:4px;font-size:0;background:${c.lime};border-radius:24px 24px 0 0;">&nbsp;</td></tr>
            <tr><td class="x4-card-body" style="padding:36px 32px 16px;">
              <h1 style="margin:0 0 20px;font-size:26px;line-height:32px;font-weight:800;letter-spacing:-0.3px;color:${c.text};">${params.title}</h1>
              ${body}${highlight}${cta}${note}
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:28px 24px 0;font-size:12px;line-height:19px;color:${c.textMuted};">
          ¿Dudas? Escribinos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${c.lime};text-decoration:none;">${SUPPORT_EMAIL}</a>
        </td></tr>
        <tr><td align="center" style="padding:8px 24px 0;font-size:12px;line-height:19px;color:${c.textMuted};">
          <a href="${SITE_URL}" style="color:${c.textSecondary};text-decoration:none;font-weight:700;">x4 match</a> · Pádel competitivo, partidos reales.
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
      preheader: `Tu código es ${escapeHtml(code)}. Vence en ${expiresInMinutes} minutos.`,
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, ingresá este código en x4 match para activar tu cuenta. Vence en ${expiresInMinutes} minutos.`,
      ],
      highlight: { label: 'Código de verificación', value: escapeHtml(code) },
      note: 'Si no creaste una cuenta, ignorá este email.',
    }),
    text: `Hola ${firstName(name)}, tu código de verificación de x4 match es ${code}. Vence en ${expiresInMinutes} minutos. Si no creaste una cuenta, ignorá este email.`,
  }),

  welcomePlayer: ({ name }) => ({
    subject: '¡Bienvenido a x4 match!',
    html: layout({
      title: `¡Bienvenido, ${escapeHtml(firstName(name))}!`,
      preheader: 'Tu cuenta ya está lista. Armá tu primer partido.',
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
      preheader: 'Estamos revisando el registro de tu club.',
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
      preheader: `${escapeHtml(name)} está pendiente de verificación.`,
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
      preheader: 'Ya podés iniciar sesión en el panel de tu club.',
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
      preheader: 'No pudimos verificar el registro de tu club.',
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
      preheader: `Tu código es ${escapeHtml(code)}. Vence en ${expiresInMinutes} minutos.`,
      paragraphs: [
        `Hola ${escapeHtml(firstName(name))}, usá este código en la app para crear una nueva contraseña. Vence en ${expiresInMinutes} minutos.`,
      ],
      highlight: { label: 'Código de recuperación', value: escapeHtml(code) },
      note: 'Si no lo pediste, ignorá este email. Tu contraseña no va a cambiar.',
    }),
    text: `Hola ${firstName(name)}, tu código de recuperación de x4 match es ${code}. Vence en ${expiresInMinutes} minutos. Si no lo pediste, ignorá este email.`,
  }),

  passwordChanged: ({ name }) => ({
    subject: 'Tu contraseña fue cambiada',
    html: layout({
      title: 'Contraseña actualizada',
      preheader: 'La contraseña de tu cuenta se cambió correctamente.',
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
      preheader: 'Eliminamos tu cuenta y tus datos personales.',
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
