const crypto = require('node:crypto');
const { enforceRateLimit } = require('../lib/lead-guard');

const TYPES = new Set(['event', 'corporate']);
const MAX = { name: 120, email: 254, phone: 24, company: 180, interest: 300, context: 3000, url: 1000 };

function clean(value, max = 500) {
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

function labels(type) {
  return type === 'event'
    ? { ownerSubject: 'Novo interesse no evento', visitorSubject: 'Você está na lista prioritária.', title: 'Lista prioritária do evento', origin: 'página do evento' }
    : { ownerSubject: 'Novo contato corporativo', visitorSubject: 'Recebemos seu interesse.', title: 'Soluções para empresas', origin: 'página Para Empresas' };
}

function ownerEmailHtml({ type, name, email, phone, company, interest, context, createdAt }) {
  const copy = labels(type);
  const firstName = name.split(/\s+/)[0] || '';
  const phoneDigits = phone.replace(/\D/g, '');
  const message = type === 'event'
    ? `Oi, ${firstName}. Recebi seu interesse na primeira edição do evento Colapsei. E Agora? pelo site.`
    : `Oi, ${firstName}. Recebi seu contato pela página Para Empresas do Colapsei. E Agora?`;
  const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
  const optionalRows = [
    company ? `<tr><td style="padding:13px;border-bottom:1px solid #d9d0c2"><b>Empresa</b></td><td style="padding:13px;border-bottom:1px solid #d9d0c2">${escapeHtml(company)}</td></tr>` : '',
    interest ? `<tr><td style="padding:13px;border-bottom:1px solid #d9d0c2"><b>Interesse</b></td><td style="padding:13px;border-bottom:1px solid #d9d0c2">${escapeHtml(interest)}</td></tr>` : '',
    context ? `<tr><td style="padding:13px;border-bottom:1px solid #d9d0c2;vertical-align:top"><b>Contexto</b></td><td style="padding:13px;border-bottom:1px solid #d9d0c2;white-space:pre-line">${escapeHtml(context)}</td></tr>` : ''
  ].join('');
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7ecd8;color:#17150f"><div style="max-width:620px;margin:auto;padding:40px 24px;font-family:Arial,sans-serif"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em">NOVO CONTATO · ${escapeHtml(copy.title.toUpperCase())}</div><h1 style="font:500 36px/1.05 Georgia,serif;margin:24px 0">${escapeHtml(name)} enviou um interesse.</h1><table role="presentation" style="width:100%;border-collapse:collapse;background:#fff8ea"><tr><td style="padding:13px;border-bottom:1px solid #d9d0c2"><b>Origem</b></td><td style="padding:13px;border-bottom:1px solid #d9d0c2">${escapeHtml(copy.origin)}</td></tr><tr><td style="padding:13px;border-bottom:1px solid #d9d0c2"><b>E-mail</b></td><td style="padding:13px;border-bottom:1px solid #d9d0c2"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr><tr><td style="padding:13px;border-bottom:1px solid #d9d0c2"><b>WhatsApp</b></td><td style="padding:13px;border-bottom:1px solid #d9d0c2">${escapeHtml(phone)}</td></tr>${optionalRows}<tr><td style="padding:13px"><b>Recebido</b></td><td style="padding:13px">${escapeHtml(createdAt)}</td></tr></table><p style="margin:28px 0"><a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;background:#7dd628;color:#17150f;text-decoration:none;padding:14px 20px;border:1px solid #17150f;border-radius:999px;font-weight:700">Responder pelo WhatsApp →</a></p><p style="font:12px/1.55 Arial,sans-serif;color:#5d584f">O contato autorizou a continuidade desta solicitação por e-mail e WhatsApp.</p></div></body></html>`;
}

function visitorEmailHtml({ type, name, siteUrl }) {
  const copy = labels(type);
  const firstName = escapeHtml(name.split(/\s+/)[0] || '');
  const body = type === 'event'
    ? 'Seu interesse na primeira edição foi registrado. Você receberá as novidades no e-mail e no WhatsApp informados.'
    : 'Seu interesse em uma solução corporativa foi registrado. O Colapsei. E Agora? poderá continuar esta conversa pelo e-mail ou WhatsApp informados.';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7ecd8;color:#17150f"><div style="max-width:620px;margin:auto;padding:44px 24px;font-family:Arial,sans-serif"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em">COLAPSEI. E AGORA? · ${escapeHtml(copy.title.toUpperCase())}</div><h1 style="font:500 38px/1.05 Georgia,serif;margin:26px 0">${firstName}, recebemos seu contato.</h1><p style="font:16px/1.65 Arial,sans-serif;color:#4b453f">${escapeHtml(body)}</p><p style="margin:30px 0"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#7dd628;color:#17150f;text-decoration:none;padding:14px 20px;border-radius:999px;font-weight:700">Voltar ao site →</a></p><p style="margin-top:40px;font:11px/1.55 Arial,sans-serif;color:#6b645a">Este canal não substitui atendimento clínico ou de emergência.</p></div></body></html>`;
}

async function sendEmail({ apiKey, from, to, subject, html, replyTo, idempotencyKey, fetchImpl = fetch }) {
  if (!apiKey || !from || !to) return false;
  const body = { from, to: [to], subject, html };
  if (replyTo) body.reply_to = replyTo;
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) console.error('interest_email_error', response.status);
    return response.ok;
  } catch (error) {
    console.error('interest_email_fetch_error', error?.message || error);
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  let stage = 'request';
  try {
    stage = 'validation';
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.website) return res.status(200).json({ saved: true, email_sent: false, owner_notified: false });

    const type = clean(body.type, 20);
    const name = clean(body.name, MAX.name);
    const email = clean(body.email, MAX.email).toLowerCase();
    const phone = normalizePhone(clean(body.phone, MAX.phone));
    const company = clean(body.company, MAX.company);
    const interest = clean(body.interest, MAX.interest);
    const context = clean(body.context, MAX.context);
    const invalidFields = [
      !TYPES.has(type) && 'type',
      !name && 'name',
      !validEmail(email) && 'email',
      !phone && 'phone',
      type === 'corporate' && !company && 'company',
      body.privacy_ack !== true && 'privacy_ack',
      body.whatsapp_contact_consent !== true && 'whatsapp_contact_consent'
    ].filter(Boolean);
    if (invalidFields.length) return res.status(400).json({ error: 'Confira os dados informados.', fields: invalidFields });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const databaseConfigured = Boolean(supabaseUrl && serviceKey);
    if (databaseConfigured) {
      stage = 'rate_limit';
      const rateLimit = await enforceRateLimit({ req, supabaseUrl, serviceKey, scope: `interest-${type}` });
      if (!rateLimit.allowed) return res.status(429).json({ error: 'Recebemos várias tentativas. Aguarde um pouco e tente novamente.' });
    } else {
      console.error('interest_database_not_configured');
    }

    const now = new Date().toISOString();
    const dbHeaders = databaseConfigured
      ? { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      : null;
    let leadId = null;
    let databaseSaved = false;
    if (databaseConfigured) {
      let persistenceStage = 'contact_save';
      try {
        const contactPayload = {
          name,
          email,
          phone,
          privacy_ack_at: now,
          whatsapp_contact_consent: true,
          whatsapp_consented_at: now,
          updated_at: now
        };
        if (type === 'event') {
          contactPayload.marketing_consent = true;
          contactPayload.marketing_consented_at = now;
        }
        const contactResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?on_conflict=email`, {
          method: 'POST',
          headers: { ...dbHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(contactPayload)
        });
        if (!contactResponse.ok) throw new Error(`Falha ao salvar contato (${contactResponse.status}).`);
        const contactId = (await contactResponse.json())[0]?.id;
        if (!contactId) throw new Error('Contato não retornou ID.');

        persistenceStage = 'lead_save';
        const leadResponse = await fetch(`${supabaseUrl}/rest/v1/interest_leads`, {
          method: 'POST',
          headers: { ...dbHeaders, Prefer: 'return=representation' },
          body: JSON.stringify({
            contact_id: contactId,
            interest_type: type,
            company: company || null,
            interest: [interest, context ? `Contexto: ${context}` : ''].filter(Boolean).join('\n\n') || null,
            source: clean(body.source, 100),
            page_url: clean(body.page_url, MAX.url),
            utm_source: clean(body.utm_source, 160),
            utm_medium: clean(body.utm_medium, 160),
            utm_campaign: clean(body.utm_campaign, 160),
            privacy_version: clean(body.privacy_version, 80) || 'site-2026-08-27'
          })
        });
        if (!leadResponse.ok) throw new Error(`Falha ao salvar interesse (${leadResponse.status}).`);
        leadId = (await leadResponse.json())[0]?.id;
        if (!leadId) throw new Error('Interesse não retornou ID.');
        databaseSaved = true;
      } catch (error) {
        console.error('interest_persistence_error', persistenceStage, error?.message || error);
      }
    }

    const copy = labels(type);
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.MAPA_FROM_EMAIL;
    const notifyEmail = process.env.MAPA_NOTIFY_EMAIL || process.env.LEAD_NOTIFY_EMAIL || process.env.MAPA_REPLY_TO;
    const siteUrl = process.env.SITE_URL || 'https://colapseieagora.com.br';
    const submissionKey = leadId || crypto
      .createHash('sha256')
      .update(`${type}|${email}|${now.slice(0, 13)}`)
      .digest('hex')
      .slice(0, 32);

    stage = 'email_delivery';
    const [emailSent, ownerNotified] = await Promise.all([
      sendEmail({
        apiKey: resendKey,
        from,
        to: email,
        subject: copy.visitorSubject,
        html: visitorEmailHtml({ type, name, siteUrl }),
        replyTo: process.env.MAPA_REPLY_TO,
        idempotencyKey: `interest-visitor-${submissionKey}`
      }),
      sendEmail({
        apiKey: resendKey,
        from,
        to: notifyEmail,
        subject: `${copy.ownerSubject}: ${name}`,
        html: ownerEmailHtml({ type, name, email, phone, company, interest, context, createdAt: now }),
        replyTo: email,
        idempotencyKey: `interest-owner-${submissionKey}`
      })
    ]);

    if (databaseSaved) {
      stage = 'delivery_status';
      try {
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/interest_leads?id=eq.${encodeURIComponent(leadId)}`, {
          method: 'PATCH',
          headers: { ...dbHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({
            email_status: emailSent ? 'sent' : (resendKey && from ? 'failed' : 'pending'),
            email_sent_at: emailSent ? new Date().toISOString() : null,
            owner_notification_status: ownerNotified ? 'sent' : (notifyEmail ? 'failed' : 'disabled'),
            owner_notified_at: ownerNotified ? new Date().toISOString() : null
          })
        });
        if (!updateResponse.ok) console.error('interest_status_update_error', updateResponse.status);
      } catch (error) {
        console.error('interest_status_update_fetch_error', error?.message || error);
      }
    }

    const accepted = databaseSaved || ownerNotified;
    if (!accepted) {
      console.error('interest_capture_unavailable', { databaseSaved, ownerNotified });
      return res.status(503).json({ error: 'Não foi possível encaminhar seu interesse agora. Tente novamente ou fale conosco pelo WhatsApp.' });
    }
    if (!databaseSaved && ownerNotified) console.error('interest_email_fallback_capture', type);
    return res.status(200).json({
      accepted: true,
      saved: true,
      database_saved: databaseSaved,
      email_sent: emailSent,
      owner_notified: ownerNotified
    });
  } catch (error) {
    console.error('interest_submit_error', stage, error?.message || error);
    return res.status(500).json({ error: 'Não foi possível registrar seu interesse agora.' });
  }
};

module.exports._test = { clean, validEmail, normalizePhone, labels, ownerEmailHtml, sendEmail };
