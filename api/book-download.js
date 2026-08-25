const {
  stripeClient,
  isPaid,
  verifyDownloadToken,
  createStorageSignedUrl
} = require('../lib/book');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const sessionId = String(req.query?.session_id || '');
  const token = String(req.query?.token || '');
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId) || !verifyDownloadToken(sessionId, token)) {
    return res.status(403).json({ error: 'Este link é inválido ou expirou.' });
  }

  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (!isPaid(session)) return res.status(403).json({ error: 'O pagamento não foi confirmado.' });
    const signedUrl = await createStorageSignedUrl(120);
    res.setHeader('Location', signedUrl);
    return res.status(302).end();
  } catch (error) {
    console.error('book_download_error', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível liberar o arquivo agora.' });
  }
};
