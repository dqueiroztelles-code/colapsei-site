const ROUTES = new Set(['collapsei', 'cresci', 'alguem', 'sistema', 'reconstruir']);
const { enforceRateLimit } = require('../lib/lead-guard');
const ROUTE_LABELS = {
  collapsei: 'Eu colapsei',
  cresci: 'Cresci no colapso',
  alguem: 'Alguém que amo colapsou',
  sistema: 'Estou perdido no sistema',
  reconstruir: 'Preciso reconstruir'
};
const MAX = { name: 120, email: 254, phone: 24, answer: 80, title: 220, url: 1000, text: 1800 };

function clean(value, max = MAX.text) {
  return String(value ?? '').trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= MAX.email;
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digits)) return `+55${digits}`;
  if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
  return '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function snapshot(raw = {}) {
  const priorities = Array.isArray(raw.priorities)
    ? raw.priorities.slice(0, 3).map((priority) => ({
      title: clean(priority?.title, 180),
      body: clean(priority?.body, 800)
    }))
    : [];
  const questions = Array.isArray(raw.questions) ? raw.questions.slice(0, 6).map((question) => clean(question, 400)) : [];
  const checklist = Array.isArray(raw.checklist) ? raw.checklist.slice(0, 12).map((item) => clean(item, 240)) : [];
  return {
    title: clean(raw.title, MAX.title),
    lead: clean(raw.lead, 1000),
    summary: clean(raw.summary, 1200),
    priorities,
    questions,
    checklist,
    orientation: clean(raw.orientation, 1200),
    next_title: clean(raw.next_title, MAX.title)
  };
}

function whatsappContactUrl(route) {
  const label = ROUTE_LABELS[route] || '';
  const message = `Olá! Acabei de fazer o Mapa do Colapso do Colapsei. E Agora?${label ? ` Minha rota foi: ${label}.` : ''} Quero organizar meus próximos passos.`;
  return `https://wa.me/5511983095381?text=${encodeURIComponent(message)}`;
}

function visitorEmailHtml({ name, result, siteUrl, contactUrl }) {
  const firstName = escapeHtml(name.split(/\s+/)[0] || '');
  const priorities = result.priorities.map((priority, index) => `<tr><td style="padding:16px 0;border-top:1px solid #d9d0c2;vertical-align:top;width:38px;font:600 12px Arial,sans-serif;color:#0f6b4c">0${index + 1}</td><td style="padding:16px 0;border-top:1px solid #d9d0c2"><div style="font:600 17px Arial,sans-serif;color:#17150f">${escapeHtml(priority.title)}</div><div style="margin-top:6px;font:14px/1.55 Arial,sans-serif;color:#5d584f">${escapeHtml(priority.body)}</div></td></tr>`).join('');
  const questions = result.questions.slice(0, 4).map((question) => `<li style="margin:0 0 9px">${escapeHtml(question)}</li>`).join('');
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7ecd8;color:#17150f"><div style="max-width:680px;margin:auto;padding:44px 24px;font-family:Arial,sans-serif"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em">COLAPSEI. E AGORA? · MAPA DO COLAPSO</div><h1 style="font:500 42px/1.02 Georgia,serif;margin:28px 0 18px">${firstName ? `${firstName}, seu Mapa está pronto.` : 'Seu Mapa está pronto.'}</h1><p style="font:17px/1.65 Arial,sans-serif;color:#5d584f">${escapeHtml(result.lead)}</p><div style="margin:30px 0;padding:24px;background:#17150f;color:#f7ecd8"><div style="font:600 11px Arial,sans-serif;letter-spacing:.12em;color:#b9d92e">SEU PONTO DE PARTIDA</div><h2 style="font:500 30px/1.05 Georgia,serif;margin:12px 0">${escapeHtml(result.title)}</h2><p style="font:15px/1.65 Arial,sans-serif;color:#ded5c7">${escapeHtml(result.summary)}</p></div><h2 style="font:500 28px Georgia,serif;margin:36px 0 8px">O que parece vir primeiro</h2><table role="presentation" style="width:100%;border-collapse:collapse">${priorities}</table><h2 style="font:500 28px Georgia,serif;margin:36px 0 14px">Perguntas que vale responder</h2><ul style="padding-left:20px;font:14px/1.55 Arial,sans-serif;color:#5d584f">${questions}</ul><p style="margin:36px 0 12px"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#b9d92e;color:#17150f;text-decoration:none;padding:14px 20px;border-radius:999px;font-weight:700">Voltar ao Mapa →</a></p><div style="margin-top:42px;padding-top:28px;border-top:1px solid #d9d0c2"><h2 style="font:500 28px Georgia,serif;margin:0 0 10px">Quer ajuda para organizar isso?</h2><p style="font:14px/1.6 Arial,sans-serif;color:#5d584f">O Colapsei. E Agora? pode ajudar a organizar informações, perguntas, responsabilidades e próximos passos. Não é terapia nem atendimento clínico. É navegação.</p><a href="${escapeHtml(contactUrl)}" style="font-weight:700;color:#0f6b4c">Falar com o Colapsei. E Agora? →</a></div><p style="margin-top:44px;font:11px/1.55 Arial,sans-serif;color:#7b7468">O Mapa do Colapso organiza informações e próximos passos. Não realiza diagnóstico, não indica tratamento, não orienta medicação e não substitui profissionais habilitados ou serviços de emergência.</p></div></body></html>`;
}

function ownerEmailHtml({ name, email, phone, route, createdAt }) {
  const phoneDigits = phone.replace(/\D/g, '');
  const message = encodeURIComponent(`Oi, ${name.split(/\s+/)[0] || ''}. Vi que você concluiu o Mapa do Colapso. Como posso ajudar a organizar seus próximos passos?`);
  const whatsappUrl = `https://wa.me/${phoneDigits}?text=${message}`;
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7ecd8;color:#17150f"><div style="max-width:620px;margin:auto;padding:40px 24px;font-family:Arial,sans-serif"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em">NOVO CONTATO · MAPA DO COLAPSO</div><h1 style="font:500 36px/1.05 Georgia,serif;margin:24px 0">${escapeHtml(name)} concluiu o Mapa.</h1><table role="presentation" style="width:100%;border-collapse:collapse;background:#fff8ea"><tr><td style="padding:14px;border-bottom:1px solid #d9d0c2"><b>Rota</b></td><td style="padding:14px;border-bottom:1px solid #d9d0c2">${escapeHtml(ROUTE_LABELS[route])}</td></tr><tr><td style="padding:14px;border-bottom:1px solid #d9d0c2"><b>E-mail</b></td><td style="padding:14px;border-bottom:1px solid #d9d0c2"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr><tr><td style="padding:14px;border-bottom:1px solid #d9d0c2"><b>WhatsApp</b></td><td style="padding:14px;border-bottom:1px solid #d9d0c2">${escapeHtml(phone)}</td></tr><tr><td style="padding:14px"><b>Recebido</b></td><td style="padding:14px">${escapeHtml(createdAt)}</td></tr></table><p style="margin:28px 0"><a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;background:#7dd628;color:#17150f;text-decoration:none;padding:14px 20px;border:1px solid #17150f;border-radius:999px;font-weight:700">Abrir conversa no WhatsApp →</a></p><p style="font:12px/1.55 Arial,sans-serif;color:#6b645a">As respostas pessoais não foram incluídas neste aviso. O contato autorizou receber uma mensagem de continuidade pelo WhatsApp.</p></div></body></html>`;
}

async function sendEmail({ apiKey, from, to, subject, html, replyTo, idempotencyKey }) {
  if (!apiKey || !from || !to) return false;
  const body = { from, to: [to], subject, html };
  if (replyTo) body.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) console.error('mapa_email_error', response.status, await response.text().catch(() => ''));
  return response.ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = clean(body.name, MAX.name);
    const email = clean(body.email, MAX.email).toLowerCase();
    const phone = normalizePhone(clean(body.phone, MAX.phone));
    const route = clean(body.route, 40);
    const privacyVersion = clean(body.privacy_version, 80);
    const answers = [clean(body.answer_1, MAX.answer), clean(body.answer_2, MAX.answer), clean(body.answer_3, MAX.answer)];

    if (body.website) return res.status(200).json({ saved: true, email_sent: false, owner_notified: false });

    const invalidFields = [
      !name && 'name',
      !validEmail(email) && 'email',
      !phone && 'phone',
      !ROUTES.has(route) && 'route',
      !privacyVersion && 'privacy_version',
      answers.some((answer) => !answer) && 'answers',
      body.privacy_ack !== true && 'privacy_ack',
      body.whatsapp_contact_consent !== true && 'whatsapp_contact_consent'
    ].filter(Boolean);

    if (invalidFields.length) {
      console.warn('mapa_validation_error', invalidFields.join(','));
      return res.status(400).json({ error: 'Confira os dados informados.', fields: invalidFields });
    }

    const result = snapshot(body.result_snapshot);
    if (!result.title || result.priorities.length !== 3) {
      console.warn('mapa_validation_error', 'result_snapshot');
      return res.status(400).json({ error: 'Resultado incompleto.', fields: ['result_snapshot'] });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: 'Banco ainda não configurado neste ambiente.', saved: false, email_sent: false, owner_notified: false });

    const dbHeaders = {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    };
    const rateLimit = await enforceRateLimit({ req, supabaseUrl, serviceKey, scope: 'mapa' });
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Recebemos várias tentativas. Aguarde um pouco e tente novamente.', saved: false, email_sent: false, owner_notified: false });
    const now = new Date().toISOString();
    const contactResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?on_conflict=email`, {
      method: 'POST',
      headers: { ...dbHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ name, email, phone, privacy_ack_at: now, whatsapp_contact_consent: true, whatsapp_consented_at: now, updated_at: now })
    });
    if (!contactResponse.ok) throw new Error(`Falha ao salvar contato (${contactResponse.status}).`);
    const contactId = (await contactResponse.json())[0]?.id;
    if (!contactId) throw new Error('Contato não retornou ID.');

    const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/map_sessions`, {
      method: 'POST',
      headers: { ...dbHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        contact_id: contactId,
        map_version: clean(body.map_version, 80),
        privacy_version: privacyVersion,
        route,
        answer_1: answers[0],
        answer_2: answers[1],
        answer_3: answers[2],
        result_title: result.title,
        utm_source: clean(body.utm_source, 160),
        utm_medium: clean(body.utm_medium, 160),
        utm_campaign: clean(body.utm_campaign, 160),
        referrer: clean(body.source, MAX.url),
        page_url: clean(body.page_url, MAX.url)
      })
    });
    if (!sessionResponse.ok) throw new Error(`Falha ao salvar sessão (${sessionResponse.status}).`);
    const sessionId = (await sessionResponse.json())[0]?.id;

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.MAPA_FROM_EMAIL;
    const notifyEmail = process.env.MAPA_NOTIFY_EMAIL || process.env.LEAD_NOTIFY_EMAIL || process.env.MAPA_REPLY_TO;
    const protocol = clean(req.headers['x-forwarded-proto'] || 'https', 20);
    const host = clean(req.headers.host || '', 255);
    const origin = host ? `${protocol}://${host}` : 'https://colapseieagora.com.br';
    const siteUrl = process.env.MAPA_SITE_URL || `${origin}/mapa`;
    const contactUrl = process.env.DULCE_CONTACT_URL || whatsappContactUrl(route);

    const [emailSent, ownerNotified] = await Promise.all([
      sendEmail({
        apiKey: resendKey,
        from,
        to: email,
        subject: 'Seu Mapa está pronto.',
        html: visitorEmailHtml({ name, result, siteUrl, contactUrl }),
        replyTo: process.env.MAPA_REPLY_TO,
        idempotencyKey: `mapa-visitor-${sessionId || body.lead_id || email}`
      }),
      sendEmail({
        apiKey: resendKey,
        from,
        to: notifyEmail,
        subject: `Novo contato no Mapa: ${name}`,
        html: ownerEmailHtml({ name, email, phone, route, createdAt: now }),
        replyTo: email,
        idempotencyKey: `mapa-owner-${sessionId || body.lead_id || email}`
      })
    ]);

    if (sessionId) {
      const update = {
        email_status: emailSent ? 'sent' : (resendKey && from ? 'failed' : 'pending'),
        email_sent_at: emailSent ? new Date().toISOString() : null,
        owner_notification_status: ownerNotified ? 'sent' : (notifyEmail ? 'failed' : 'disabled'),
        owner_notified_at: ownerNotified ? new Date().toISOString() : null
      };
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/map_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { ...dbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(update)
      });
      if (!updateResponse.ok) console.error('mapa_status_update_error', updateResponse.status);
    }

    return res.status(200).json({ saved: true, email_sent: emailSent, owner_notified: ownerNotified, session_id: sessionId || null });
  } catch (error) {
    console.error('mapa_submit_error', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível concluir o envio agora.', saved: false, email_sent: false, owner_notified: false });
  }
};

module.exports._test = { clean, validEmail, normalizePhone, snapshot, whatsappContactUrl };
