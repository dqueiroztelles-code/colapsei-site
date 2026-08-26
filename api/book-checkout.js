const crypto = require('crypto');
const {
  BOOK_PRICE_ID,
  stripeClient,
  siteOrigin,
  deliveryConfiguration
} = require('../lib/book');

const DEFAULT_KIWIFY_CHECKOUT_URL = 'https://pay.kiwify.com.br/FMBFGL4';

function externalCheckoutUrl() {
  const provider = String(process.env.BOOK_CHECKOUT_PROVIDER || 'kiwify').trim().toLowerCase();
  if (provider === 'stripe') return '';

  const candidate = String(process.env.BOOK_EXTERNAL_CHECKOUT_URL || DEFAULT_KIWIFY_CHECKOUT_URL).trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.hostname !== 'pay.kiwify.com.br') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function randomIdentifier() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from(crypto.randomBytes(8), (value) => alphabet[value % alphabet.length]).join('');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const externalUrl = externalCheckoutUrl();
    if (externalUrl) return res.status(200).json({ url: externalUrl, provider: 'kiwify' });

    const configuration = deliveryConfiguration();
    const missing = Object.entries(configuration).filter(([, configured]) => !configured).map(([name]) => name);
    if (missing.length) {
      console.error('book_checkout_configuration_missing', missing.join(','));
      return res.status(503).json({ error: 'A compra está temporariamente indisponível. Fale com a Dulce pelo WhatsApp.' });
    }

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve();
    if (!account.charges_enabled) {
      return res.status(503).json({ error: 'A compra está temporariamente indisponível. Fale com a Dulce pelo WhatsApp.' });
    }

    const origin = siteOrigin(req);
    const priceId = process.env.STRIPE_BOOK_PRICE_ID || BOOK_PRICE_ID;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'hosted',
      locale: 'pt-BR',
      customer_creation: 'always',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/livro-obrigada?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/livro`,
      metadata: {
        product_slug: 'burnoutei-e-agora',
        delivery: 'protected_pdf',
        site: 'colapsei-e-agora'
      },
      payment_intent_data: {
        metadata: {
          product_slug: 'burnoutei-e-agora',
          site: 'colapsei-e-agora'
        }
      },
      custom_text: {
        submit: { message: 'O PDF será liberado após a confirmação e enviado ao e-mail informado.' }
      },
      integration_identifier: `colapsei_${randomIdentifier()}`
    });

    if (!session.url) throw new Error('A Stripe não retornou o endereço do checkout.');
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('book_checkout_error', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível abrir o checkout agora. Fale com a Dulce pelo WhatsApp.' });
  }
};

module.exports._test = { externalCheckoutUrl, DEFAULT_KIWIFY_CHECKOUT_URL };
