const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../api/interest');
const { requestFingerprint } = require('../lib/lead-guard');

test('normaliza WhatsApp e valida e-mail do lead', () => {
  assert.equal(_test.normalizePhone('(21) 98888-7777'), '+5521988887777');
  assert.equal(_test.normalizePhone('+55 21 98888-7777'), '+5521988887777');
  assert.equal(_test.normalizePhone('123'), '');
  assert.equal(_test.validEmail('pessoa@empresa.com.br'), true);
  assert.equal(_test.validEmail('pessoa@'), false);
});

test('e-mail interno do lead contém origem e resposta contextual sem expor segredo', () => {
  const html = _test.ownerEmailHtml({
    type: 'corporate',
    name: 'QA Site',
    email: 'qa@example.com',
    phone: '+5511999998888',
    company: 'Empresa QA',
    interest: 'Workshop',
    context: 'A empresa precisa organizar o retorno de colaboradores após afastamentos.',
    createdAt: '2026-08-27T12:00:00.000Z'
  });
  assert.match(html, /página Para Empresas/);
  assert.match(html, /Responder pelo WhatsApp/);
  assert.match(html, /Empresa QA/);
  assert.match(html, /Contexto/);
  assert.match(html, /retorno de colaboradores/);
  assert.doesNotMatch(html, /SUPABASE|RESEND_API_KEY/);
});

test('fingerprint de limitação não guarda IP ou agente em texto aberto', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'Browser QA' } };
  const fingerprint = requestFingerprint(req, 'segredo-de-teste');
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(fingerprint, /203\.0\.113\.7|Browser QA/);
});
