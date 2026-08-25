const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../api/mapa');

test('normaliza WhatsApp brasileiro com e sem DDI', () => {
  assert.equal(_test.normalizePhone('(11) 99999-8888'), '+5511999998888');
  assert.equal(_test.normalizePhone('+55 11 99999-8888'), '+5511999998888');
  assert.equal(_test.normalizePhone('123'), '');
});

test('valida e-mail sem aceitar formatos incompletos', () => {
  assert.equal(_test.validEmail('pessoa@exemplo.com'), true);
  assert.equal(_test.validEmail('pessoa@'), false);
  assert.equal(_test.validEmail('pessoa exemplo@site.com'), false);
});

test('snapshot limita listas e tamanho dos campos', () => {
  const result = _test.snapshot({
    title: 'T'.repeat(300),
    priorities: Array.from({ length: 8 }, (_, index) => ({ title: `P${index}`, body: 'Texto' })),
    questions: Array.from({ length: 10 }, (_, index) => `Q${index}`),
    checklist: Array.from({ length: 20 }, (_, index) => `I${index}`)
  });
  assert.equal(result.title.length, 220);
  assert.equal(result.priorities.length, 3);
  assert.equal(result.questions.length, 6);
  assert.equal(result.checklist.length, 12);
});

test('link do WhatsApp contém a rota sem respostas pessoais', () => {
  const url = _test.whatsappContactUrl('collapsei');
  assert.match(url, /^https:\/\/wa\.me\/5511983095381\?text=/);
  assert.match(decodeURIComponent(url), /Minha rota foi: Eu colapsei/);
});
