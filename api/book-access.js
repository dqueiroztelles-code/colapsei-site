const {
  stripeClient,
  siteOrigin,
  isPaid,
  customerEmail,
  protectedDownloadUrl,
  fulfillBookSession
} = require('../lib/book');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const sessionId = String(req.query?.session_id || '');
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) return res.status(400).json({ error: 'Compra inválida.' });

  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (!isPaid(session)) return res.status(202).json({ paid: false, message: 'O pagamento ainda está sendo confirmado.' });

    const origin = siteOrigin(req);
    let emailSent = false;
    try {
      const fulfillment = await fulfillBookSession(session, origin);
      emailSent = fulfillment.emailSent;
    } catch (error) {
      console.error('book_access_fulfillment_error', error?.message || error);
    }

    return res.status(200).json({
      paid: true,
      email: customerEmail(session),
      email_sent: emailSent,
      download_url: protectedDownloadUrl(origin, session.id)
    });
  } catch (error) {
    if (error?.statusCode === 404) return res.status(404).json({ error: 'Compra não encontrada.' });
    console.error('book_access_error', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível confirmar a compra agora.' });
  }
};
