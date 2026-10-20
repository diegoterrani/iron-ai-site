/* Teste de navegador do formulário de contato (Playwright), fora do `npm test`.
   Uso: com o site servido (ex.: `python3 -m http.server 8765` na raiz),
     npm run test:e2e
   Variáveis: E2E_BASE_URL (padrão http://localhost:8765).
   Precisa do pacote `playwright` com o Chromium instalado (local ou global,
   via NODE_PATH="$(npm root -g)"). /api/contato e o Turnstile são simulados. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = (process.env.E2E_BASE_URL || 'http://localhost:8765').replace(/\/$/, '');

async function fillValid(page) {
  await page.selectOption('#f-motivo', 'Sessão executiva');
  await page.selectOption('#f-porte', '250 a 999');
  await page.fill('#f-mensagem', 'Queremos entender o caso.');
  await page.fill('#f-nome', 'Maria Souza');
  await page.fill('#f-cargo', 'CEO');
  await page.fill('#f-empresa', 'Rede Exemplo');
  await page.fill('#f-email', 'maria@rede-exemplo.com.br');
  await page.check('#f-consentimento');
  /* o widget não carrega offline: injeta o campo que ele criaria */
  await page.evaluate(() => {
    const i = document.createElement('input');
    i.type = 'hidden'; i.name = 'cf-turnstile-response'; i.value = 'XXXX.DUMMY.TOKEN.XXXX';
    document.querySelector('.cf-turnstile').appendChild(i);
  });
}

async function scenario(browser, { status, body }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/challenges.cloudflare.com/**', (r) => r.abort());
  let posted = null;
  await page.route('**/api/contato', async (r) => {
    posted = JSON.parse(r.request().postData());
    await new Promise((res) => setTimeout(res, 150));   /* deixa o estado "Enviando…" aparecer */
    await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${BASE}/contato.html`);
  await fillValid(page);
  await page.click('[data-submit]');
  await page.getByText('Enviando…').waitFor({ state: 'visible', timeout: 2000 });
  await page.waitForResponse('**/api/contato');
  await page.waitForTimeout(150);
  return { page, errors, posted };
}

const browser = await chromium.launch();
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.log(`not ok - ${name}\n  ${e.message.split('\n').join('\n  ')}`); }
}

await check('envio 200: formulário some, "Pedido recebido." visível e com foco', async () => {
  const { page, errors, posted } = await scenario(browser, { status: 200, body: { ok: true, message: 'Pedido recebido.' } });
  assert.equal(posted.motivo, 'Sessão executiva');
  assert.equal(posted['cf-turnstile-response'], 'XXXX.DUMMY.TOKEN.XXXX');
  assert.equal(await page.locator('[data-contato-form]').isVisible(), false, 'formulário ainda visível');
  assert.equal(await page.locator('[data-contato-form]').evaluate((f) => getComputedStyle(f).display), 'none');
  const success = page.locator('[data-form-success]');
  assert.equal(await success.isVisible(), true);
  assert.equal(await page.getByText('Pedido recebido.').isVisible(), true);
  assert.equal(await success.evaluate((el) => el === document.activeElement), true, 'foco não está na mensagem de sucesso');
  assert.equal(await page.getByText('Enviando…').filter({ visible: true }).count(), 0, '"Enviando…" visível');
  assert.equal(await page.locator('[data-submit]').isDisabled(), false);
  assert.deepEqual(errors, []);
  await page.close();
});

await check('envio 500: botão volta a habilitado, alerta visível, formulário mantido', async () => {
  const { page, errors } = await scenario(browser, { status: 500, body: { ok: false, error: 'Serviço indisponível no momento.' } });
  const btn = page.locator('[data-submit]');
  assert.equal(await btn.isEnabled(), true);
  assert.equal(await btn.getAttribute('aria-busy'), 'false');
  assert.equal((await page.locator('[data-submit-label]').textContent()).trim(), 'Enviar pedido');
  const alert = page.locator('[data-form-alert]');
  assert.equal(await alert.isVisible(), true);
  assert.equal(await alert.getAttribute('role'), 'alert');
  assert.equal((await alert.textContent()).trim(), 'Serviço indisponível no momento.');
  assert.equal(await page.locator('[data-contato-form]').isVisible(), true);
  assert.equal(await page.locator('[data-form-success]').isVisible(), false);
  assert.deepEqual(errors, []);
  await page.close();
});

await browser.close();
console.log(failed ? `\n${failed} falha(s)` : '\ne2e: tudo certo');
process.exit(failed ? 1 : 0);
