/* Teste de navegador do aviso de cookies e da tag do Google Ads (Playwright),
   fora do `npm test`. Sobe um servidor estático próprio que aplica os cabeçalhos
   do vercel.json (inclusive a CSP), então nenhuma violação de CSP passa batida.
   Uso: NODE_PATH="$(npm root -g)" npm run test:e2e:consent
   O Google é simulado: gtag.js vira um dublê que chama os mesmos hosts que a
   tag real (pixel, fetch e iframe) para conferir a CSP. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

/* cabeçalhos do vercel.json que valem para o caminho (regras sem has/missing) */
function headersFor(path) {
  const out = {};
  for (const rule of vercel.headers) {
    if (rule.has || rule.missing) continue;
    if (new RegExp(`^${rule.source}$`).test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
  if (!file.startsWith(ROOT) || /\/\.|\/api\/|\/tests\//.test(path)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...headersFor(path) });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
/* localhost (e não 127.0.0.1): contexto seguro, como em produção */
const BASE = `http://localhost:${server.address().port}`;

/* dublê do gtag.js: processa a fila como a tag real faria e toca os hosts que ela usa */
const FAKE_GTAG = `
  window.__gtagLoaded = (window.__gtagLoaded || 0) + 1;
  document.cookie = '_gcl_au=1.1.teste; path=/; SameSite=Lax';
  new Image().src = 'https://www.googleadservices.com/pagead/conversion/18531760156/?x=1';
  new Image().src = 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/18531760156/?x=1';
  new Image().src = 'https://www.google.com.br/pagead/1p-user-list/18531760156/?x=1';
  fetch('https://www.google.com/ccm/collect?x=1', { mode: 'no-cors' }).catch(function () {});
  fetch('https://ad.doubleclick.net/x', { mode: 'no-cors' }).catch(function () {});
  var f = document.createElement('iframe'); f.src = 'https://www.googletagmanager.com/static/service_worker/x/sw_iframe.html'; f.hidden = true;
  document.body.appendChild(f);
`;

const browser = await chromium.launch();
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.log(`not ok - ${name}\n  ${e.message.split('\n').join('\n  ')}`); }
}

async function open(path, { viewport = { width: 1440, height: 900 }, context } = {}) {
  const ctx = context || await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const google = [];
  const errors = [];
  const csp = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  await page.route('**/challenges.cloudflare.com/**', (r) => r.abort());
  await page.route(/^https:\/\/([a-z0-9.-]+\.)?(google|googletagmanager|googleadservices|doubleclick|googlesyndication)\.[a-z.]+\//, (r) => {
    google.push(r.request().url());
    if (r.request().url().includes('/gtag/js')) return r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GTAG });
    if (r.request().resourceType() === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' });
    return r.fulfill({ status: 204, body: '' });
  });
  await page.goto(`${BASE}/${path}`);
  await page.waitForTimeout(300);
  return { ctx, page, google, errors, csp };
}

const PAGES = ['index.html', 'esteira.html', 'casos-de-uso.html', 'contato.html', 'politica-de-privacidade.html'];
const banner = (page) => page.locator('section.consent');

for (const p of PAGES) {
  await check(`${p}: primeira visita mostra o aviso e nada vai ao Google`, async () => {
    const { ctx, page, google, errors, csp } = await open(p);
    assert.equal(await banner(page).isVisible(), true, 'aviso não apareceu');
    assert.deepEqual(google, [], 'requisição ao Google antes do aceite');
    assert.equal(await page.evaluate(() => typeof window.gtag), 'undefined');
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true, 'aviso roubou o foco');
    assert.deepEqual(errors, []);
    assert.deepEqual(csp, []);
    await ctx.close();
  });

  await check(`${p}: Aceitar carrega gtag.js com AW-18531760156, Consent Mode v2 e sem violar a CSP`, async () => {
    const { ctx, page, google, errors, csp } = await open(p);
    await page.getByRole('button', { name: 'Aceitar' }).click();
    await page.waitForFunction(() => window.__gtagLoaded === 1);
    await page.waitForTimeout(500);
    assert.equal(await banner(page).isVisible(), false);
    assert.ok(google.some((u) => u === 'https://www.googletagmanager.com/gtag/js?id=AW-18531760156'), google.join('\n'));
    const dl = await page.evaluate(() => window.dataLayer.map((a) => Array.from(a)));
    const iDefault = dl.findIndex((a) => a[0] === 'consent' && a[1] === 'default');
    const iUpdate = dl.findIndex((a) => a[0] === 'consent' && a[1] === 'update');
    const iConfig = dl.findIndex((a) => a[0] === 'config');
    assert.ok(iDefault === 0 && iUpdate > iDefault && iConfig > iUpdate, JSON.stringify(dl));
    assert.deepEqual(dl[iDefault][2], { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    assert.deepEqual(dl[iUpdate][2], { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    assert.equal(dl[iConfig][1], 'AW-18531760156');
    assert.deepEqual(errors, []);
    assert.deepEqual(csp, [], 'violação de CSP com os hosts do Google Ads');
    await ctx.close();
  });
}

await check('aceite vale nas próximas páginas sem perguntar de novo', async () => {
  const first = await open('index.html');
  await first.page.getByRole('button', { name: 'Aceitar' }).click();
  const next = await open('esteira.html', { context: first.ctx });
  assert.equal(await banner(next.page).count(), 0, 'aviso montado de novo');
  await next.page.waitForFunction(() => window.__gtagLoaded === 1);
  await first.ctx.close();
});

await check('Recusar: nada vai ao Google, nem nesta página nem na próxima', async () => {
  const first = await open('contato.html');
  await first.page.getByRole('button', { name: 'Recusar' }).click();
  assert.equal(await banner(first.page).isVisible(), false);
  const next = await open('casos-de-uso.html', { context: first.ctx });
  assert.equal(await banner(next.page).count(), 0);
  assert.deepEqual([...first.google, ...next.google], []);
  await first.ctx.close();
});

await check('Preferências de cookies (rodapé): reabre com foco, revoga e apaga _gcl_*', async () => {
  const { ctx, page } = await open('esteira.html');
  await page.getByRole('button', { name: 'Aceitar' }).click();
  await page.waitForFunction(() => window.__gtagLoaded === 1);
  assert.match(await page.evaluate(() => document.cookie), /_gcl_au=/);
  const pref = page.locator('.site-footer [data-consent-open]');
  await pref.scrollIntoViewIfNeeded();
  await pref.click();
  assert.equal(await banner(page).isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Recusar');
  await page.keyboard.press('Enter');
  assert.equal(await banner(page).isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-consent-open')), true, 'foco não voltou ao botão');
  assert.doesNotMatch(await page.evaluate(() => document.cookie), /_gcl_au=/);
  const last = await page.evaluate(() => Array.from(window.dataLayer.at(-1)));
  assert.deepEqual(last, ['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('iron-consent')));
  assert.equal(stored.ads, 'denied');
  await ctx.close();
});

await check('escolha vencida (mais de 12 meses) pergunta de novo', async () => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem('iron-consent',
    JSON.stringify({ v: 1, ads: 'granted', ts: Date.now() - 400 * 24 * 3600 * 1000 })));
  const { page, google } = await open('index.html', { context: ctx });
  assert.equal(await banner(page).isVisible(), true);
  assert.deepEqual(google, []);
  await ctx.close();
});

await check('conversão: só com aceite e rótulo configurado; sem rótulo não envia nada', async () => {
  const { ctx, page } = await open('contato.html');
  assert.equal(await page.evaluate(() => window.IronConsent.conversion('contato')), false, 'sem aceite');
  await page.getByRole('button', { name: 'Aceitar' }).click();
  await page.waitForFunction(() => window.__gtagLoaded === 1);
  /* rótulo vazio no repositório: a conversão fica desligada até ser configurada */
  const enabled = /contato: '([^']+)'/.test(readFileSync(join(ROOT, 'js/consent.js'), 'utf8'));
  const sent = await page.evaluate(() => window.IronConsent.conversion('contato'));
  assert.equal(sent, enabled);
  const conv = await page.evaluate(() => window.dataLayer.map((a) => Array.from(a)).filter((a) => a[1] === 'conversion'));
  assert.equal(conv.length, enabled ? 1 : 0);
  if (enabled) assert.match(conv[0][2].send_to, /^AW-18531760156\/[A-Za-z0-9_-]+$/);
  await ctx.close();
});

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  await check(`aviso cabe na tela sem rolagem lateral (${vp.width})`, async () => {
    const { ctx, page } = await open('index.html', { viewport: vp });
    const box = await banner(page).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height, JSON.stringify(box));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'rolagem lateral');
    for (const name of ['Aceitar', 'Recusar']) {
      const b = await page.getByRole('button', { name }).boundingBox();
      assert.ok(b.height >= 24 && b.width >= 24, `${name}: alvo ${JSON.stringify(b)}`);
    }
    await page.screenshot({ path: join(process.env.E2E_SHOTS || '/tmp', `consent-${vp.width}.png`) });
    await ctx.close();
  });
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} falha(s)` : '\ne2e consent: tudo certo');
process.exit(failed ? 1 : 0);
