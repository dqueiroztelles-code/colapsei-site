const {
  stripeClient,
  siteOrigin,
  fulfillBookSession
} = require('../lib/book');

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return res.status(400).json({ error: 'Webhook não configurado.' });

  let event;
  try {
    const body = await rawBody(req);
    event = stripeClient().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('book_webhook_signature_error', error?.message || error);
    return res.status(400).json({ error: 'Assinatura inválida.' });
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const session = event.data.object;
    const result = await fulfillBookSession(session, siteOrigin(req));
    return res.status(200).json({ received: true, fulfilled: result.paid, email_sent: result.emailSent });
  } catch (error) {
    console.error('book_webhook_fulfillment_error', event.id, error?.message || error);
    return res.status(500).json({ error: 'A entrega não foi concluída; a Stripe tentará novamente.' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
