// Envío de correos vía Resend (API HTTP, sin SMTP).
// Degradación segura: sin RESEND_API_KEY solo loguea el código (modo desarrollo).

const RESEND_API_URL = 'https://api.resend.com/emails';

function plantillaCodigo(nombre, codigo) {
  return `
  <div style="background:#0a0a0a;padding:32px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#171717;border-radius:24px;overflow:hidden;border:1px solid #262626;">
      <div style="padding:28px 32px 8px;">
        <div style="color:#e11d48;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Taller MS</div>
        <h1 style="color:#fafafa;font-size:22px;margin:14px 0 6px;">Recuperá tu contraseña</h1>
        <p style="color:#a3a3a3;font-size:14px;line-height:1.5;margin:0;">
          Hola${nombre ? ' ' + nombre : ''}, usá este código para restablecer tu contraseña. Vence en 10 minutos.
        </p>
      </div>
      <div style="padding:24px 32px 12px;text-align:center;">
        <div style="display:inline-block;background:#0a0a0a;border:1px solid #be123c;border-radius:16px;padding:18px 28px;">
          <span style="color:#fafafa;font-size:38px;font-weight:700;letter-spacing:10px;font-family:'JetBrains Mono','Courier New',monospace;">${codigo}</span>
        </div>
      </div>
      <div style="padding:8px 32px 30px;">
        <p style="color:#737373;font-size:12px;line-height:1.5;margin:0;">
          Si no pediste este cambio, podés ignorar este correo. Nadie podrá cambiar tu contraseña sin este código.
        </p>
      </div>
    </div>
  </div>`;
}

/**
 * Envía el código de recuperación al correo del cliente.
 * Nunca lanza: ante cualquier fallo loguea y devuelve false (la ruta responde genérico igual).
 */
async function enviarCodigoReset(email, nombre, codigo) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Taller MS <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(`📧 [DEV] Código de recuperación para ${email}: ${codigo}`);
    return true;
  }

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Tu código para recuperar la contraseña',
        html: plantillaCodigo(nombre, codigo),
      }),
    });
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      console.error('⚠️  Resend respondió error:', resp.status, detalle);
      return false;
    }
    return true;
  } catch (err) {
    console.error('⚠️  Error enviando correo:', err.message);
    return false;
  }
}

module.exports = { enviarCodigoReset };
