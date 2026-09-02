const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(full) : [full];
  });
}

function publicPathFor(file) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === 'index.html') return '/';
  return `/${relative.replace(/\.html$/, '')}`;
}

function existingTarget(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!clean) return fs.existsSync(path.join(root, 'index.html'));
  return [clean, `${clean}.html`, `${clean}/index.html`].some((candidate) => fs.existsSync(path.join(root, candidate)));
}

test('todos os links internos apontam para páginas ou arquivos existentes', () => {
  const htmlFiles = filesIn(root).filter((file) => file.endsWith('.html'));
  const missing = [];

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const base = `https://colapseieagora.com.br${publicPathFor(file)}`;
    for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
      const href = match[1].trim();
      if (!href || href.includes('${') || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
      const url = new URL(href, base);
      if (url.origin !== 'https://colapseieagora.com.br') continue;
      if (!existingTarget(url.pathname)) missing.push(`${path.relative(root, file)} → ${href}`);
      if (url.hash && url.pathname === new URL(base).pathname) {
        const id = decodeURIComponent(url.hash.slice(1));
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`\\bid=["']${escaped}["']`).test(html)) missing.push(`${path.relative(root, file)} → fragmento ${href}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test('checkout do livro abre nova aba no desktop e mantém navegação no celular', () => {
  const htmlFiles = filesIn(root).filter((file) => file.endsWith('.html'));
  const checkoutFiles = htmlFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('id="bookBuyButton"'));

  assert.ok(checkoutFiles.length > 0);
  for (const file of checkoutFiles) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /desktopCheckout=window\.matchMedia\('\(min-width: 768px\)'\)\.matches/);
    assert.match(html, /window\.open\(checkoutUrl,'_blank','noopener'\)/);
    assert.match(html, /location\.href=checkoutUrl/);
    assert.match(html, /https:\/\/pay\.kiwify\.com\.br\/FMBFGL4/);
    assert.match(html, /Pagamento e entrega realizados pela Kiwify/);
    assert.doesNotMatch(html, /Pagamento seguro (?:por cartão )?pela Stripe/);
    assert.doesNotMatch(html, /\/api\/book-checkout/);
  }
});

test('captação corporativa e do evento inclui e-mail, WhatsApp e consentimento', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /data-lead-type="corporate"/);
  assert.match(html, /data-lead-type="event"/);
  assert.equal((html.match(/name="phone"/g) || []).length, 2);
  assert.equal((html.match(/name="consent"/g) || []).length, 2);
  assert.match(html, /fetch\('\/api\/interest'/);
});

test('públicos corporativos têm continuidade equivalente e formulário completo', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api', 'interest.js'), 'utf8');
  const companyPage = html.match(/<!-- EMPRESAS -->([\s\S]*?)<!-- SOBRE -->/)[1];
  assert.match(companyPage, /Palestra · 60 a 90 minutos/);
  assert.match(companyPage, /Experiência completa · 2h30 a 3h/);
  assert.match(companyPage, /Liderar sem improvisar cuidado/);
  assert.match(companyPage, /Programa Corporativo Personalizado/);
  assert.match(companyPage, /escolas, escritórios de advocacia, agências de publicidade, consultorias, indústrias/);
  assert.doesNotMatch(companyPage, /\[X\]/);
  assert.match(companyPage, /<option>Palestra para equipes · 60 a 90 minutos<\/option>/);
  assert.match(companyPage, /<option>Experiência Colapsei\. E Agora\? · 2h30 a 3h<\/option>/);
  assert.match(companyPage, /<option>Treinamento para RH e lideranças · 2h30 a 3h<\/option>/);
  assert.match(companyPage, /<option>Programa Corporativo Personalizado<\/option>/);
  assert.match(companyPage, /<textarea[^>]+name="context"[^>]+maxlength="3000"|<textarea[^>]+maxlength="3000"[^>]+name="context"/);
  assert.match(html, /context:data\.get\('context'\)\|\|''/);
  assert.match(api, /const context = clean\(body\.context, MAX\.context\)/);
  assert.match(api, /Contexto: \$\{context\}/);
});

test('links de WhatsApp têm origem e mensagem contextual', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<a\b[^>]*href="https:\/\/wa\.me\/5511983095381[^>]*>/g)].map((match) => match[0]);
  assert.ok(links.length >= 12);
  for (const link of links) {
    assert.match(link, /data-wa-message=/);
    assert.match(link, /data-wa-source=/);
  }
  assert.doesNotMatch(html, /consultoria personalizada/i);
  assert.doesNotMatch(html, /data-wa-message="[^"]*Dulce/i);
  assert.doesNotMatch(html, /CONVERSA DIRETA COM A DULCE|WhatsApp da Dulce|fale diretamente com a Dulce|Fale com a Dulce/i);
});

test('atendimento do Mapa usa a marca e preserva o nome pessoal apenas na autoria', () => {
  const mapa = fs.readFileSync(path.join(root, 'mapa.html'), 'utf8');
  const mapaApi = fs.readFileSync(path.join(root, 'api', 'mapa.js'), 'utf8');
  assert.match(mapa, /Quero organizar isso com o Colapsei\. E Agora\?/);
  assert.match(mapaApi, /Falar com o Colapsei\. E Agora\?/);
  assert.doesNotMatch(mapa, /Oi, Dulce|com a Dulce|da Dulce|A Dulce/);
  assert.doesNotMatch(mapaApi, /Oi, Dulce|com a Dulce|da Dulce|A Dulce/);
});

test('instrumentação de experiência e campanha está presente', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /\/_vercel\/insights\/script\.js/);
  assert.match(html, /\/_vercel\/speed-insights\/script\.js/);
  assert.match(html, /url\.searchParams\.set\('src','site_livro'\)/);
});

test('canal oficial do YouTube está disponível e mensurável em todo o site', () => {
  const htmlFiles = filesIn(root).filter((file) => file.endsWith('.html') && path.basename(file) !== '404.html');
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /https:\/\/www\.youtube\.com\/@colapseieieagora/);
    assert.match(html, /YouTube(?: ·)? @colapseieieagora(?: ↗)?/);
  }
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /trackEvent\('youtube_click'/);
});

test('marcadores editoriais orientam sem numeração decorativa', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const labels = [
    'ENTENDA O CENÁRIO · QUANDO TUDO SAI DO EIXO',
    'COMECE POR AQUI · MAPA DO COLAPSO',
    'COMO FUNCIONA</span><i aria-hidden="true">·</i> MÉTODO E AGORA?',
    'NAVEGAÇÃO PERSONALIZADA · INTERNAÇÃO E CONTINUIDADE',
    'ESCOLHA SEU CAMINHO · PARA VOCÊ, FAMÍLIAS E EMPRESAS',
    'PARA EMPRESAS · PALESTRAS, EXPERIÊNCIAS E PROGRAMAS',
    'QUEM CRIOU · DULCE TELLES, FUNDADORA',
    'LIVRO DIGITAL · DISPONÍVEL AGORA',
    'EVENTO PRESENCIAL · PRIMEIRA EDIÇÃO'
  ];

  for (const label of labels) assert.ok(html.includes(label), `Marcador ausente: ${label}`);
  assert.doesNotMatch(html, /<div class="section-label[^"]*">0[1-8] · (?:O QUE ACONTECE|O PRIMEIRO PASSO|O MÉTODO|NAVEGAÇÃO PERSONALIZADA|PARA EMPRESAS|DULCE TELLES · FUNDADORA|LIVRO DIGITAL · DISPONÍVEL|EXPERIÊNCIA AO VIVO)/);
  assert.match(html, /class="method-index">01<\/span>/);
  assert.match(html, /class="method-index">05<\/span>/);
});
