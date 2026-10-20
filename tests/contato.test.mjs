/* Testes de /api/contato e da lógica pura (node --test, sem dependências). */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import handler from '../api/contato.js';
import {
  validateContato, buildEmail, buildSubject, isOriginAllowed, clientIp, normalizeLine,
  MAX_BODY_BYTES, REQUIRED_ENV
} from '../api/_lib/contato-core.js';

const ORIGIN = 'https://iron-ai.example';
const ENV = {
  ALLOWED_ORIGINS: `${ORIGIN}, https://outro.example`,
  TURNSTILE_SECRET_KEY: 'segredo-de-teste',
  RESEND_API_KEY: 're_teste',
  CONTACT_FROM: 'IRON AI <site@iron-ai.example>',
  CONTACT_TO: 'contato@iron-ai.example'
};

const valid = () => ({
  motivo: 'Sessão executiva gratuita',
  nome: 'Maria Souza',
  cargo: 'CEO',
  empresa: 'Rede Exemplo',
  email: 'maria@rede-exemplo.com.br',
  telefone: '+55 (11) 99999-0000',
  porte: '250 a 999',
  mensagem: 'Queremos entender onde a IA mexe na margem.\nTemos 40 lojas.',
  consentimento: true,
  website: '',
  'cf-turnstile-response': 'XXXX.DUMMY.TOKEN.XXXX'
});

/* ---------- dublês de req/res/fetch ---------- */
function makeReq({ method = 'POST', body, raw, headers = {} } = {}) {
  const payload = raw !== undefined ? raw : body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from([Buffer.from(payload)]);
  req.method = method;
  req.headers = {
    'content-type': 'application/json',
    origin: ORIGIN,
    'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    ...headers
  };
  return req;
}

function makeRes() {
  const res = {
    statusCode: 200, headers: {}, body: null, headersSent: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ? JSON.parse(b) : null; this.headersSent = true; }
  };
  return res;
}

let calls;
let logs;
const realFetch = globalThis.fetch;
const realLog = console.log;
const savedEnv = {};

function mockFetch({ turnstile = { success: true, hostname: 'iron-ai.example' }, turnstileStatus = 200, resendStatus = 200, throwOn } = {}) {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (throwOn && String(url).includes(throwOn)) {
      const e = new Error('aborted'); e.name = 'AbortError'; throw e;
    }
    if (String(url).includes('challenges.cloudflare.com')) {
      return new Response(JSON.stringify(turnstile), { status: turnstileStatus, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes('api.resend.com')) {
      return new Response(JSON.stringify(resendStatus < 300 ? { id: 'x' } : { message: 'erro' }), { status: resendStatus });
    }
    throw new Error('url inesperada ' + url);
  };
}

async function run(reqOpts) {
  const res = makeRes();
  await handler(makeReq(reqOpts), res);
  return res;
}

beforeEach(() => {
  calls = [];
  logs = [];
  console.log = (s) => logs.push(String(s));
  for (const k of [...REQUIRED_ENV, 'TURNSTILE_EXPECTED_HOSTNAME']) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, ENV);
  mockFetch();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const pii = ['Maria', 'maria@', 'Rede Exemplo', '99999', '203.0.113.7', 'lojas', 'segredo-de-teste', 're_teste'];
function assertNoPii() {
  for (const line of logs) {
    JSON.parse(line); // log estruturado
    for (const p of pii) assert.ok(!line.includes(p), `log com dado sensível (${p}): ${line}`);
  }
}

/* ---------- caminho feliz ---------- */
test('pedido válido: verifica o Turnstile, envia pelo Resend e responde 200', async () => {
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, message: 'Pedido recebido.' });
  assert.equal(calls.length, 2);

  const [ts, mail] = calls;
  assert.equal(ts.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  const form = new URLSearchParams(ts.opts.body);
  assert.equal(form.get('secret'), 'segredo-de-teste');
  assert.equal(form.get('response'), 'XXXX.DUMMY.TOKEN.XXXX');
  assert.equal(form.get('remoteip'), '203.0.113.7');
  assert.ok(ts.opts.signal instanceof AbortSignal);

  assert.equal(mail.url, 'https://api.resend.com/emails');
  assert.equal(mail.opts.headers.Authorization, 'Bearer re_teste');
  assert.ok(mail.opts.signal instanceof AbortSignal);
  const p = JSON.parse(mail.opts.body);
  assert.equal(p.from, ENV.CONTACT_FROM);
  assert.deepEqual(p.to, ['contato@iron-ai.example']);
  assert.equal(p.reply_to, 'maria@rede-exemplo.com.br');
  assert.equal(p.subject, '[IRON AI] Sessão executiva gratuita — Rede Exemplo');
  assert.ok(p.text.includes('Mensagem:\nQueremos entender'));
  assert.equal(p.html, undefined);
  assertNoPii();
});

test('campos opcionais vazios são aceitos', async () => {
  const body = valid(); body.telefone = ''; body.mensagem = '';
  const res = await run({ body });
  assert.equal(res.statusCode, 200);
  assert.ok(JSON.parse(calls[1].opts.body).text.includes('Telefone: (não informado)'));
});

/* ---------- validação, campo a campo ---------- */
const invalidCases = [
  ['motivo', 'Comprar ações'], ['motivo', undefined],
  ['nome', ''], ['nome', 'A'], ['nome', 'x'.repeat(101)], ['nome', 'Maria\r\nBcc: x@y.z'], ['nome', 42],
  ['cargo', ''], ['cargo', 'c'.repeat(101)],
  ['empresa', ''], ['empresa', 'e'.repeat(121)],
  ['email', ''], ['email', 'maria'], ['email', 'maria@exemplo'], ['email', 'ma ria@x.com'], ['email', 'a@b.com\nBcc: c@d.com'],
  ['email', 'a'.repeat(250) + '@x.com'],
  ['telefone', 'abc'], ['telefone', '123'], ['telefone', '9'.repeat(31)],
  ['porte', '10 mil'], ['porte', ''],
  ['mensagem', 'm'.repeat(1001)], ['mensagem', { a: 1 }], ['mensagem', 'oi\u0000'],
  ['consentimento', false], ['consentimento', 'true'], ['consentimento', undefined],
  ['cf-turnstile-response', ''], ['cf-turnstile-response', 't'.repeat(2049)]
];
for (const [field, value] of invalidCases) {
  test(`campo inválido: ${field} = ${JSON.stringify(value)?.slice(0, 40)}`, async () => {
    const body = valid();
    if (value === undefined) delete body[field]; else body[field] = value;
    const res = await run({ body });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.deepEqual(res.body.fields, [field]);
    assert.equal(calls.length, 0, 'não chama serviços externos');
    assertNoPii();
  });
}

test('chave desconhecida é rejeitada (allowlist)', async () => {
  const res = await run({ body: { ...valid(), admin: true } });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.fields, ['_body']);
});

test('JSON malformado: 400', async () => {
  const res = await run({ raw: '{"motivo":' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
});

test('corpo que não é objeto: 400', async () => {
  const res = await run({ raw: '[1,2]' });
  assert.equal(res.statusCode, 400);
});

/* ---------- honeypot ---------- */
test('honeypot preenchido: 200 genérico e nada é enviado', async () => {
  const res = await run({ body: { ...valid(), website: 'https://spam.example' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, message: 'Pedido recebido.' });
  assert.equal(calls.length, 0);
  assert.ok(logs.some((l) => JSON.parse(l).evt === 'honeypot'));
});

/* ---------- protocolo ---------- */
for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
  test(`método ${method}: 405 com Allow: POST`, async () => {
    const res = await run({ method });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
    assert.equal(res.body.ok, false);
  });
}

test('Content-Type diferente de JSON: 415', async () => {
  const res = await run({ body: valid(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.statusCode, 415);
  assert.equal(calls.length, 0);
});

test('Content-Type JSON com charset é aceito', async () => {
  const res = await run({ body: valid(), headers: { 'content-type': 'application/json; charset=utf-8' } });
  assert.equal(res.statusCode, 200);
});

test('origem fora da lista: 403', async () => {
  const res = await run({ body: valid(), headers: { origin: 'https://atacante.example' } });
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 0);
});

test('sem Origin, Referer da lista é aceito; Referer de fora é rejeitado; nenhum dos dois é rejeitado', async () => {
  let res = await run({ body: valid(), headers: { origin: undefined, referer: `${ORIGIN}/contato.html` } });
  assert.equal(res.statusCode, 200);
  res = await run({ body: valid(), headers: { origin: undefined, referer: 'https://atacante.example/x' } });
  assert.equal(res.statusCode, 403);
  res = await run({ body: valid(), headers: { origin: undefined } });
  assert.equal(res.statusCode, 403);
  res = await run({ body: valid(), headers: { origin: 'null' } });
  assert.equal(res.statusCode, 403);
});

test('corpo maior que 10 KB: 413 (pelo Content-Length e pela leitura)', async () => {
  const big = { ...valid(), mensagem: 'x'.repeat(MAX_BODY_BYTES) };
  let res = await run({ body: big });
  assert.equal(res.statusCode, 413);
  res = await run({ body: big, headers: { 'content-length': String(MAX_BODY_BYTES + 1) } });
  assert.equal(res.statusCode, 413);
  assert.equal(calls.length, 0);
});

/* ---------- serviços externos ---------- */
test('Turnstile recusa: 403 genérico e nenhum e-mail', async () => {
  mockFetch({ turnstile: { success: false, 'error-codes': ['invalid-input-response'] } });
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.ok, false);
  assert.equal(calls.length, 1);
  const l = logs.map((x) => JSON.parse(x)).find((x) => x.evt === 'turnstile_failed');
  assert.deepEqual(l.codes, ['invalid-input-response']);
  assertNoPii();
});

test('Turnstile com hostname diferente do esperado: 403', async () => {
  process.env.TURNSTILE_EXPECTED_HOSTNAME = 'iron-ai.example';
  mockFetch({ turnstile: { success: true, hostname: 'outro.example' } });
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('Turnstile com hostname esperado: 200', async () => {
  process.env.TURNSTILE_EXPECTED_HOSTNAME = 'iron-ai.example';
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 200);
});

test('Turnstile fora do ar (timeout): 403 genérico', async () => {
  mockFetch({ throwOn: 'challenges.cloudflare.com' });
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 403);
  assert.ok(!JSON.stringify(res.body).includes('aborted'));
});

test('Resend falha: 502 genérico, sem detalhe do provedor', async () => {
  mockFetch({ resendStatus: 500 });
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(Object.keys(res.body).sort(), ['error', 'ok']);
  assert.ok(!JSON.stringify(res.body).includes('stack'));
  assertNoPii();
});

test('Resend fora do ar (timeout): 502', async () => {
  mockFetch({ throwOn: 'api.resend.com' });
  const res = await run({ body: valid() });
  assert.equal(res.statusCode, 502);
});

/* ---------- configuração ---------- */
for (const name of REQUIRED_ENV) {
  test(`variável ${name} ausente: 500 e log config_missing sem valor`, async () => {
    delete process.env[name];
    const res = await run({ body: valid() });
    assert.equal(res.statusCode, 500);
    const l = logs.map((x) => JSON.parse(x)).find((x) => x.evt === 'config_missing');
    assert.equal(l.variable, name);
    assertNoPii();
    assert.equal(calls.length, 0);
  });
}

/* ---------- anti header injection ---------- */
test('quebra de linha no assunto é neutralizada', () => {
  const subject = buildSubject({ motivo: 'Parceria', empresa: 'ACME\r\nBcc: vitima@x.com\nX-Header: 1' });
  assert.ok(!/[\r\n]/.test(subject));
  assert.equal(subject, '[IRON AI] Parceria — ACME Bcc: vitima@x.com X-Header: 1');
  assert.equal(normalizeLine('a\u2028b\u0085c\td'), 'a b c d');
});

test('injeção de quebra de linha na empresa é rejeitada pela API', async () => {
  const res = await run({ body: { ...valid(), empresa: 'ACME\r\nBcc: vitima@x.com' } });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.fields, ['empresa']);
  assert.equal(calls.length, 0);
});

test('e-mail montado: texto puro, reply_to do lead, vários destinatários', () => {
  const v = validateContato(valid());
  assert.ok(v.ok);
  const p = buildEmail(v.data, { ...ENV, CONTACT_TO: 'a@x.com, b@y.com' }, new Date('2026-10-20T12:00:00Z'));
  assert.deepEqual(p.to, ['a@x.com', 'b@y.com']);
  assert.equal(p.reply_to, 'maria@rede-exemplo.com.br');
  assert.ok(p.text.includes('Consentimento LGPD: sim (2026-10-20T12:00:00.000Z)'));
  assert.ok(!('html' in p));
});

/* ---------- utilitários ---------- */
test('origens: normalização e comparação exata', () => {
  assert.equal(isOriginAllowed({ origin: 'https://IRON-AI.example' }, ' https://iron-ai.example/ '), true);
  assert.equal(isOriginAllowed({ origin: 'https://iron-ai.example.atacante.com' }, 'https://iron-ai.example'), false);
  assert.equal(isOriginAllowed({ origin: 'http://iron-ai.example' }, 'https://iron-ai.example'), false);
  assert.equal(isOriginAllowed({ origin: 'https://iron-ai.example' }, ''), false);
});

test('IP do cliente: primeiro valor de x-forwarded-for', () => {
  assert.equal(clientIp({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }), '198.51.100.2');
  assert.equal(clientIp({ 'x-forwarded-for': '2001:db8::1' }), '2001:db8::1');
  assert.equal(clientIp({ 'x-forwarded-for': '<script>' }), '');
  assert.equal(clientIp({}), '');
});
