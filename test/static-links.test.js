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
    assert.match(html, /desktopCheckout\?window\.open\('about:blank','_blank'\):null/);
    assert.match(html, /else\{\s*location\.href=checkoutUrl\.toString\(\);/);
    assert.match(html, /Pagamento seguro processado pela Kiwify/);
    assert.doesNotMatch(html, /Pagamento seguro (?:por cartão )?pela Stripe/);
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

test('links de WhatsApp têm origem e mensagem contextual', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<a\b[^>]*href="https:\/\/wa\.me\/5511983095381[^>]*>/g)].map((match) => match[0]);
  assert.ok(links.length >= 12);
  for (const link of links) {
    assert.match(link, /data-wa-message=/);
    assert.match(link, /data-wa-source=/);
  }
  assert.doesNotMatch(html, /consultoria personalizada/i);
});

test('instrumentação de experiência e campanha está presente', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /\/_vercel\/insights\/script\.js/);
  assert.match(html, /\/_vercel\/speed-insights\/script\.js/);
  assert.match(html, /checkoutUrl\.searchParams\.set\('src','site_livro'\)/);
});
