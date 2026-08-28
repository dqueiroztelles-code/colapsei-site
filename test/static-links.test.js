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
    assert.match(html, /https:\/\/pay\.kiwify\.com\.br\/FMBFGL4/);
    assert.match(html, /window\.open\(destination\.toString\(\),'_blank','noopener'\)/);
    assert.match(html, /location\.href=destination\.toString\(\)/);
    assert.match(html, /Pagamento seguro processado pela Kiwify/);
    assert.doesNotMatch(html, /\/api\/book-checkout/);
    assert.doesNotMatch(html, /Pagamento seguro (?:por cartão )?pela Stripe/);
  }
});
