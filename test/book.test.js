const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BOOK_DOWNLOAD_TOKEN_SECRET = 'segredo-local-de-teste-com-tamanho-suficiente';

const {
  signDownloadToken,
  verifyDownloadToken,
  protectedDownloadUrl,
  isPaid,
  customerEmail
} = require('../lib/book');

test('link protegido aceita apenas sessão, assinatura e validade corretas', () => {
  const sessionId = 'cs_live_abc123';
  const token = signDownloadToken(sessionId, Math.floor(Date.now() / 1000) + 120);
  assert.equal(verifyDownloadToken(sessionId, token), true);
  assert.equal(verifyDownloadToken('cs_live_outro', token), false);
  assert.equal(verifyDownloadToken(sessionId, `${token}alterado`), false);
});

test('link expirado é rejeitado', () => {
  const sessionId = 'cs_live_abc123';
  const token = signDownloadToken(sessionId, Math.floor(Date.now() / 1000) - 1);
  assert.equal(verifyDownloadToken(sessionId, token), false);
});

test('URL de download não expõe o arquivo do Storage', () => {
  const url = protectedDownloadUrl('https://colapseieagora.com.br', 'cs_live_abc123');
  assert.match(url, /^https:\/\/colapseieagora\.com\.br\/api\/book-download\?/);
  assert.doesNotMatch(url, /supabase|burnoutei-e-agora\.pdf/);
});

test('pagamento e e-mail são lidos da sessão Stripe', () => {
  const session = { payment_status: 'paid', customer_details: { email: ' Pessoa@Exemplo.com ' } };
  assert.equal(isPaid(session), true);
  assert.equal(customerEmail(session), 'pessoa@exemplo.com');
  assert.equal(isPaid({ payment_status: 'unpaid' }), false);
});
