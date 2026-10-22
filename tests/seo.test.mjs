/* Coerência entre sitemap.xml, robots.txt, canonical das páginas e regras de noindex do vercel.json
   (node --test, sem dependências). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ORIGIN = 'https://iron-ai.io';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

// URL pública -> arquivo servido (cleanUrls: false, então só "/" vira index.html).
const fileOf = (url) => {
  const path = new URL(url).pathname;
  return path === '/' ? 'index.html' : path.slice(1);
};

// Caminhos com noindex no domínio de produção (regras sem condição de host).
const noindexSources = vercel.headers
  .filter((h) => !h.has && !h.missing)
  .filter((h) => h.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)))
  .map((h) => h.source);

test('sitemap.xml é um urlset válido com URLs absolutas de produção, sem repetição', () => {
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(locs.length > 0);
  assert.equal(new Set(locs).size, locs.length);
  for (const loc of locs) assert.ok(loc.startsWith(`${ORIGIN}/`), loc);
  for (const [, d] of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('toda URL do sitemap existe, tem canonical igual e não está em noindex', () => {
  for (const loc of locs) {
    const file = fileOf(loc);
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `arquivo ausente: ${file}`);
    assert.ok(!file.startsWith('.loop') && !file.startsWith('api/'), `fora do site público: ${file}`);
    assert.ok(read(file).includes(`<link rel="canonical" href="${loc}">`), `canonical divergente em ${file}`);
    assert.ok(!noindexSources.includes(`/${file}`), `${file} está no sitemap e em noindex`);
  }
});

test('index.html não aparece como /index.html (duplicata da raiz)', () => {
  assert.ok(!locs.includes(`${ORIGIN}/index.html`));
});

test('robots.txt libera o site, bloqueia /api/ e aponta para o sitemap', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, 'm'));
});

test('qualquer host que não seja iron-ai.io recebe noindex (evita conteúdo duplicado em *.vercel.app)', () => {
  const rule = vercel.headers.find((h) =>
    h.source === '/(.*)' && h.missing?.some((m) => m.type === 'host' && m.value === 'iron-ai.io'));
  assert.ok(rule);
  assert.ok(rule.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)));
});

test('política de privacidade segue em noindex enquanto tiver campos [a definir]', () => {
  if (read('politica-de-privacidade.html').includes('[a definir]')) {
    assert.ok(noindexSources.includes('/politica-de-privacidade.html'));
    assert.ok(!locs.includes(`${ORIGIN}/politica-de-privacidade.html`));
  }
});
