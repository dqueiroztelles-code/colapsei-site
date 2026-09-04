const test = require('node:test');
const assert = require('node:assert/strict');

const interestHandler = require('../api/interest');
const { _test } = interestHandler;
const { enforceRateLimit, requestFingerprint } = require('../lib/lead-guard');

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

test('falha de rede no e-mail não derruba o registro do interesse', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const sent = await _test.sendEmail({
      apiKey: 'resend_test',
      from: 'site@example.com',
      to: 'lead@example.com',
      subject: 'Teste',
      html: '<p>Teste</p>',
      idempotencyKey: 'interest-test',
      fetchImpl: async () => { throw new Error('fetch failed'); }
    });
    assert.equal(sent, false);
  } finally {
    console.error = originalError;
  }
});

test('falha de rede no rate limit degrada sem bloquear o formulário', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await enforceRateLimit({
      req: { headers: { 'x-forwarded-for': '203.0.113.8', 'user-agent': 'QA' } },
      supabaseUrl: 'https://example.supabase.co',
      serviceKey: 'segredo-de-teste',
      scope: 'interest-corporate',
      fetchImpl: async () => { throw new Error('fetch failed'); }
    });
    assert.deepEqual(result, { allowed: true, degraded: true });
  } finally {
    console.error = originalError;
  }
});

test('indisponibilidade do banco usa o e-mail interno como contingência', async () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAPA_FROM_EMAIL: process.env.MAPA_FROM_EMAIL,
    MAPA_NOTIFY_EMAIL: process.env.MAPA_NOTIFY_EMAIL
  };
  console.error = () => {};
  process.env.SUPABASE_URL = 'https://database.example.com';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.RESEND_API_KEY = 'resend-key';
  process.env.MAPA_FROM_EMAIL = 'site@example.com';
  process.env.MAPA_NOTIFY_EMAIL = 'contato@example.com';
  global.fetch = async (url) => {
    if (String(url).startsWith('https://api.resend.com/')) return { ok: true, status: 200 };
    throw new Error('fetch failed');
  };

  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'QA' },
    body: {
      type: 'corporate',
      name: 'Teste de Contingência',
      email: 'lead@example.com',
      phone: '(11) 99999-9999',
      company: 'Empresa QA',
      interest: 'Palestra',
      context: 'Teste automatizado.',
      privacy_ack: true,
      whatsapp_contact_consent: true
    }
  };
  const res = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  try {
    await interestHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.accepted, true);
    assert.equal(res.body.saved, true);
    assert.equal(res.body.database_saved, false);
    assert.equal(res.body.owner_notified, true);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
