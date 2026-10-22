/* Tag do Google Ads e consentimento: coerência entre páginas, js/consent.js e a CSP
   do vercel.json (node --test, sem dependências). O comportamento no navegador
   fica em tests/e2e-consent.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pages = readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html'));
const consent = read('js/consent.js');
const vercel = JSON.parse(read('vercel.json'));

const TAG_ID = 'AW-18531760156';
// Hosts que a documentação do Google exige para Google Ads (tag-platform/security/guides/csp).
const REQUIRED = {
  'script-src': ['https://www.googletagmanager.com', 'https://www.googleadservices.com', 'https://www.google.com'],
  'img-src': ['https://www.googletagmanager.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net',
    'https://pagead2.googlesyndication.com', 'https://www.google.com', 'https://www.google.com.br'],
  'connect-src': ['https://www.googletagmanager.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net',
    'https://pagead2.googlesyndication.com', 'https://www.google.com', 'https://www.google.com.br', 'https://ad.doubleclick.net'],
  'frame-src': ['https://www.googletagmanager.com']
};

// CSP do vercel.json (cabeçalho) e a <meta http-equiv> de cada página: o navegador
// aplica as duas, então os hosts precisam estar nas duas.
const csps = [
  ...vercel.headers.flatMap((h) => h.headers
    .filter((x) => x.key === 'Content-Security-Policy')
    .map((x) => ({ source: h.source, value: x.value }))),
  ...pages.map((f) => ({ source: f, value: (read(f).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '' }))
];
const directives = (value) => Object.fromEntries(value.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

test('toda página carrega js/consent.js e só uma tag do Google (via consent.js)', () => {
  assert.ok(pages.length >= 5);
  for (const f of pages) {
    const html = read(f);
    assert.equal((html.match(/<script src="js\/consent\.js" defer><\/script>/g) || []).length, 1, f);
    assert.doesNotMatch(html, /<script[^>]+googletagmanager\.com/, `${f}: a tag entra só pelo consent.js`);
  }
});

test('nenhuma página tem script inline (a CSP não libera unsafe-inline)', () => {
  for (const f of pages) {
    for (const [, attrs] of read(f).matchAll(/<script\b([^>]*)>/g)) assert.match(attrs, /\bsrc=/, `${f}: <script${attrs}>`);
  }
});

test('CSP: hosts do Google Ads liberados, sem unsafe-inline/unsafe-eval nem curingas', () => {
  assert.equal(csps.length, 2 + pages.length);
  for (const { source, value } of csps) {
    assert.ok(value, `${source}: sem CSP`);
    const d = directives(value);
    for (const [k, hosts] of Object.entries(REQUIRED)) {
      for (const h of hosts) assert.ok(d[k] && d[k].includes(h), `${source}: ${k} sem ${h}`);
    }
    assert.doesNotMatch(value, /unsafe-inline|unsafe-eval|\*/, source);
    assert.deepEqual(d['default-src'], ["'self'"]);
    assert.deepEqual(d['object-src'], ["'none'"]);
    if (!source.endsWith('.html')) assert.deepEqual(d['frame-ancestors'], ["'none'"]);  /* ignorado em <meta> */
  }
});

test('consent.js: tag certa, default negado antes do config e gtag.js só dentro de loadGtag', () => {
  assert.match(consent, new RegExp(`var TAG_ID = '${TAG_ID}'`));
  const body = consent.slice(consent.indexOf('function loadGtag'), consent.indexOf('function revoke'));
  const iDefault = body.indexOf("gtag('consent', 'default'");
  const iUpdate = body.indexOf("gtag('consent', 'update'");
  const iConfig = body.indexOf("gtag('config', TAG_ID)");
  assert.ok(iDefault > -1 && iDefault < iUpdate && iUpdate < iConfig, 'ordem default -> update -> config');
  for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
    assert.match(body.slice(iDefault, iUpdate), new RegExp(`${k}: 'denied'`));
  }
  assert.doesNotMatch(body.slice(iUpdate, iConfig), /analytics_storage/, 'Analytics não é concedido');
  assert.equal((consent.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
  assert.ok(consent.indexOf('googletagmanager.com/gtag/js') > consent.indexOf('function loadGtag'));
  assert.doesNotMatch(consent, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
});

test('contato.js dispara a conversão só no sucesso, sem dados do formulário', () => {
  const js = read('js/contato.js');
  const calls = [...js.matchAll(/IronConsent\.conversion\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(calls, ["'contato'"]);
  const success = js.slice(js.indexOf('function showSuccess'), js.indexOf('var SERVER_FIELD_MSG'));
  assert.match(success, /IronConsent\.conversion\('contato'\)/);
});

test('política de privacidade explica os cookies e permite rever a escolha', () => {
  const html = read('politica-de-privacidade.html');
  assert.match(html, /id="cookies"/);
  assert.match(html, /Google Ads/);
  assert.match(html, /data-consent-open/);
});
