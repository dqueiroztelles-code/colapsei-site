const crypto = require('crypto');
const Stripe = require('stripe');

const API_VERSION = '2026-07-29.dahlia';
const BOOK_PRICE_ID = 'price_1U44p7Fq3KXPzDmi8VL5aUMM';
const DOWNLOAD_TTL_SECONDS = 7 * 24 * 60 * 60;
let stripeInstance;

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurada.');
  if (!stripeInstance) stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: API_VERSION });
  return stripeInstance;
}

function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const protocol = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req?.headers?.host || 'colapseieagora.com.br').split(',')[0].trim();
  return `${protocol}://${host}`;
}

function customerEmail(session) {
  return String(session?.customer_details?.email || session?.customer_email || '').trim().toLowerCase();
}

function isPaid(session) {
  return session?.payment_status === 'paid' || session?.payment_status === 'no_payment_required';
}

function tokenSecret() {
  return process.env.BOOK_DOWNLOAD_TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
}

function signDownloadToken(sessionId, expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS) {
  const secret = tokenSecret();
  if (!secret) throw new Error('Segredo do link de download não configurado.');
  const payload = `${sessionId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${expiresAt}.${signature}`;
}

function verifyDownloadToken(sessionId, token) {
  const secret = tokenSecret();
  const [expiresRaw, suppliedSignature] = String(token || '').split('.');
  const expiresAt = Number(expiresRaw);
  if (!secret || !Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000) || !suppliedSignature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${sessionId}.${expiresAt}`).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && crypto.timingSafeEqual(supplied, wanted);
}

function protectedDownloadUrl(origin, sessionId, expiresAt) {
  const token = signDownloadToken(sessionId, expiresAt);
  return `${origin}/api/book-download?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase não configurado.');
  return { url: url.replace(/\/$/, ''), key };
}

function supabaseHeaders(key, prefer) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function upsertBookOrder(session, fields = {}) {
  const { url, key } = supabaseConfig();
  const payload = {
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
    customer_email: customerEmail(session) || null,
    amount_total: Number.isInteger(session.amount_total) ? session.amount_total : null,
    currency: session.currency || null,
    payment_status: session.payment_status || 'unpaid',
    updated_at: new Date().toISOString(),
    ...fields
  };
  const response = await fetch(`${url}/rest/v1/book_orders?on_conflict=stripe_session_id`, {
    method: 'POST',
    headers: supabaseHeaders(key, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Falha ao registrar pedido (${response.status}).`);
  return (await response.json())[0] || null;
}

async function existingBookOrder(sessionId) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/book_orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=email_status,email_sent_at,fulfillment_status&limit=1`, {
    headers: supabaseHeaders(key)
  });
  if (!response.ok) throw new Error(`Falha ao consultar pedido (${response.status}).`);
  return (await response.json())[0] || null;
}

function bookEmailHtml({ downloadUrl }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7ecd8;color:#17150f"><div style="max-width:640px;margin:auto;padding:44px 24px;font-family:Arial,sans-serif"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em">COLAPSEI. E AGORA? · LIVRO DIGITAL</div><h1 style="font:500 42px/1.02 Georgia,serif;margin:28px 0 18px">Seu livro está pronto.</h1><p style="font:17px/1.65 Arial,sans-serif;color:#5d584f">Obrigada por comprar <i>Burnoutei, e agora?</i>. Use o botão abaixo para baixar o PDF e salve uma cópia no seu dispositivo.</p><p style="margin:32px 0"><a href="${downloadUrl}" style="display:inline-block;background:#7dd628;color:#17150f;text-decoration:none;padding:15px 22px;border:1px solid #17150f;border-radius:999px;font-weight:700">Baixar meu livro →</a></p><p style="font:12px/1.55 Arial,sans-serif;color:#6b645a">Este link é pessoal e protegido. Ele fica disponível por 7 dias. Se precisar de ajuda, responda a este e-mail.</p></div></body></html>`;
}

async function sendBookEmail({ email, downloadUrl, sessionId }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOOK_FROM_EMAIL || process.env.MAPA_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Entrega por e-mail não configurada.');
  const payload = {
    from,
    to: [email],
    subject: 'Seu livro Burnoutei, e agora? está pronto.',
    html: bookEmailHtml({ downloadUrl })
  };
  const replyTo = process.env.BOOK_REPLY_TO || process.env.MAPA_REPLY_TO;
  if (replyTo) payload.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `book-delivery-${sessionId}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Falha ao enviar o livro (${response.status}).`);
  return true;
}

async function fulfillBookSession(session, origin) {
  if (!isPaid(session)) return { paid: false, emailSent: false };
  const email = customerEmail(session);
  if (!email) throw new Error('A sessão paga não contém e-mail do comprador.');

  const previous = await existingBookOrder(session.id).catch(() => null);
  if (previous?.email_status === 'sent') {
    await upsertBookOrder(session, { fulfillment_status: 'fulfilled', email_status: 'sent', email_sent_at: previous.email_sent_at || new Date().toISOString() });
    return { paid: true, emailSent: true, email };
  }

  await upsertBookOrder(session, { fulfillment_status: 'pending', email_status: 'pending' });
  const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS;
  const downloadUrl = protectedDownloadUrl(origin, session.id, expiresAt);
  try {
    await sendBookEmail({ email, downloadUrl, sessionId: session.id });
    await upsertBookOrder(session, { fulfillment_status: 'fulfilled', email_status: 'sent', email_sent_at: new Date().toISOString() });
    return { paid: true, emailSent: true, email };
  } catch (error) {
    await upsertBookOrder(session, { fulfillment_status: 'failed', email_status: 'failed' }).catch(() => {});
    throw error;
  }
}

async function createStorageSignedUrl(expiresIn = 120) {
  const { url, key } = supabaseConfig();
  const bucket = process.env.BOOK_STORAGE_BUCKET;
  const path = process.env.BOOK_STORAGE_PATH;
  if (!bucket || !path) throw new Error('Arquivo do livro não configurado.');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'POST',
    headers: supabaseHeaders(key),
    body: JSON.stringify({ expiresIn })
  });
  if (!response.ok) throw new Error(`Falha ao assinar o arquivo (${response.status}).`);
  const data = await response.json();
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) throw new Error('O Storage não retornou um link assinado.');
  return signedPath.startsWith('http') ? signedPath : `${url}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
}

function deliveryConfiguration() {
  return {
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    token: Boolean(tokenSecret()),
    database: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    storage: Boolean(process.env.BOOK_STORAGE_BUCKET && process.env.BOOK_STORAGE_PATH),
    email: Boolean(process.env.RESEND_API_KEY && (process.env.BOOK_FROM_EMAIL || process.env.MAPA_FROM_EMAIL))
  };
}

module.exports = {
  API_VERSION,
  BOOK_PRICE_ID,
  DOWNLOAD_TTL_SECONDS,
  stripeClient,
  siteOrigin,
  customerEmail,
  isPaid,
  signDownloadToken,
  verifyDownloadToken,
  protectedDownloadUrl,
  upsertBookOrder,
  fulfillBookSession,
  createStorageSignedUrl,
  deliveryConfiguration
};
