import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = '<style>';
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error('Marcador <style> não encontrado em index.html.');
const sharedShell = source.slice(markerIndex);
const targets = [
  'condicoes-de-compra.html',
  'contato.html',
  'empresas.html',
  'evento.html',
  'livro.html',
  'navegacoes.html',
  'privacidade.html',
  'sobre.html',
  'navegacoes/divisao-do-cuidado.html',
  'navegacoes/internacao.html',
  'navegacoes/plano-de-alta.html'
];

for (const relative of targets) {
  const target = path.join(root, relative);
  const html = fs.readFileSync(target, 'utf8');
  const targetMarkerIndex = html.indexOf(marker);
  if (targetMarkerIndex < 0) throw new Error(`Marcador <style> não encontrado em ${relative}.`);
  const head = html.slice(0, targetMarkerIndex).replace(
    '"sameAs":["https://www.instagram.com/colapsei.eagora/"]',
    '"sameAs":["https://www.instagram.com/colapsei.eagora/","https://www.youtube.com/@colapseieieagora"]'
  );
  fs.writeFileSync(target, `${head}${sharedShell}`);
}

console.log(`Shell sincronizado em ${targets.length} páginas.`);
