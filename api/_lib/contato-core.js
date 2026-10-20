/* =========================================================================
   IRON AI — lógica pura do formulário de contato (sem E/S, testável).
   Usada por api/contato.js. O prefixo "_" impede a Vercel de expor este
   arquivo como função. As regras de validação são espelhadas no cliente
   (js/contato.js): mudou aqui, mude lá.
   ========================================================================= */

export const MAX_BODY_BYTES = 10 * 1024;
export const EXTERNAL_TIMEOUT_MS = 5000;

export const MOTIVOS = Object.freeze([
  'Sessão executiva gratuita',
  'Deep-dive ou implementação',
  'Parceria',
  'Outro assunto'
]);

export const PORTES = Object.freeze([
  'até 49 pessoas',
  '50 a 249',
  '250 a 999',
  '1.000 ou mais'
]);

/* variáveis obrigatórias; TURNSTILE_EXPECTED_HOSTNAME é opcional */
export const REQUIRED_ENV = Object.freeze([
  'ALLOWED_ORIGINS',
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
  'CONTACT_FROM',
  'CONTACT_TO'
]);

export const HONEYPOT_FIELD = 'website';
export const TOKEN_FIELD = 'cf-turnstile-response';

const ALLOWED_KEYS = new Set([
  'motivo', 'nome', 'cargo', 'empresa', 'email', 'telefone', 'porte',
  'mensagem', 'consentimento', HONEYPOT_FIELD, TOKEN_FIELD
]);

export const LIMITS = Object.freeze({
  nome: { min: 2, max: 100 },
  cargo: { min: 2, max: 100 },
  empresa: { min: 2, max: 120 },
  email: { max: 254 },
  telefone: { max: 30 },
  mensagem: { max: 1000 },
  token: { max: 2048 }
});

/* e-mail: local@dominio.tld, sem espaços, rótulos de domínio válidos */
export const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;
/* telefone: dígitos e + ( ) - . espaço, com 8 a 15 dígitos */
export const PHONE_RE = /^[0-9+().\s-]{8,30}$/;

/* caracteres de controle (inclui CR/LF) e separadores de linha Unicode */
const CTRL_SINGLE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;
/* no texto livre, só \n e \t são aceitos */
const CTRL_MULTI = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029]/;

/** Remove quebras de linha e controles de um valor de linha única (assunto, cabeçalhos). */
export function normalizeLine(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Texto livre: CRLF/CR viram LF; demais controles saem. */
export function normalizeMultiline(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029]/g, '')
    .trim();
}

export function isHoneypotFilled(input) {
  if (!input || typeof input !== 'object') return false;
  const v = input[HONEYPOT_FIELD];
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function textField(input, key, { min = 0, max, required = true }, errors) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === '') {
    if (required) errors[key] = 'required';
    return '';
  }
  if (typeof raw !== 'string') { errors[key] = 'type'; return ''; }
  if (CTRL_SINGLE.test(raw)) { errors[key] = 'chars'; return ''; }
  const v = raw.trim().replace(/\s{2,}/g, ' ');
  if (v === '') { if (required) errors[key] = 'required'; return ''; }
  if (v.length < min || v.length > max) { errors[key] = 'length'; return ''; }
  return v;
}

/**
 * Valida o corpo do pedido por allowlist.
 * Retorna { ok: true, data } ou { ok: false, errors: { campo: código } }.
 * Códigos: required, type, chars, length, format, value, unknown.
 */
export function validateContato(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { _body: 'type' } };
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) errors[key] = 'unknown';
  }

  const motivo = input.motivo;
  if (typeof motivo !== 'string' || !MOTIVOS.includes(motivo)) errors.motivo = motivo ? 'value' : 'required';

  const nome = textField(input, 'nome', LIMITS.nome, errors);
  const cargo = textField(input, 'cargo', LIMITS.cargo, errors);
  const empresa = textField(input, 'empresa', LIMITS.empresa, errors);

  let email = textField(input, 'email', { min: 3, max: LIMITS.email.max }, errors);
  if (email && !EMAIL_RE.test(email)) { errors.email = 'format'; email = ''; }

  let telefone = textField(input, 'telefone', { min: 0, max: LIMITS.telefone.max, required: false }, errors);
  if (telefone) {
    const digits = telefone.replace(/\D/g, '').length;
    if (!PHONE_RE.test(telefone) || digits < 8 || digits > 15) { errors.telefone = 'format'; telefone = ''; }
  }

  const porte = input.porte;
  if (typeof porte !== 'string' || !PORTES.includes(porte)) errors.porte = porte ? 'value' : 'required';

  let mensagem = '';
  if (input.mensagem !== undefined && input.mensagem !== null && input.mensagem !== '') {
    if (typeof input.mensagem !== 'string') errors.mensagem = 'type';
    else if (CTRL_MULTI.test(input.mensagem.replace(/\r/g, ''))) errors.mensagem = 'chars';
    else {
      mensagem = normalizeMultiline(input.mensagem);
      if (mensagem.length > LIMITS.mensagem.max) { errors.mensagem = 'length'; mensagem = ''; }
    }
  }

  if (input.consentimento !== true) errors.consentimento = 'required';

  const token = input[TOKEN_FIELD];
  if (typeof token !== 'string' || token.length === 0) errors[TOKEN_FIELD] = 'required';
  else if (token.length > LIMITS.token.max || CTRL_SINGLE.test(token)) errors[TOKEN_FIELD] = 'format';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: { motivo, nome, cargo, empresa, email, telefone, porte, mensagem, consentimento: true, token }
  };
}

/** Lista de destinatários a partir de "a@x.com, b@y.com". */
export function parseList(value) {
  return String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function normalizeOrigin(value) {
  try {
    const u = new URL(String(value).trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** Origin (ou, na falta dele, a origem do Referer) precisa estar na allowlist. */
export function isOriginAllowed(headers, allowedCsv) {
  const allowed = new Set(parseList(allowedCsv).map(normalizeOrigin).filter(Boolean));
  if (!allowed.size) return false;
  const h = headers || {};
  const origin = h.origin;
  if (origin && origin !== 'null') {
    const o = normalizeOrigin(origin);
    return !!o && allowed.has(o);
  }
  const referer = h.referer || h.referrer;
  if (referer) {
    const o = normalizeOrigin(referer);
    return !!o && allowed.has(o);
  }
  return false;
}

/** Primeiro IP de x-forwarded-for (a Vercel o define); vazio se ausente ou estranho. */
export function clientIp(headers) {
  const xff = (headers && headers['x-forwarded-for']) || '';
  const first = String(Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(first) ? first : '';
}

export function missingEnv(env) {
  return REQUIRED_ENV.filter((name) => !env[name] || !String(env[name]).trim());
}

export function buildSubject(data) {
  const subject = `[IRON AI] ${normalizeLine(data.motivo)} — ${normalizeLine(data.empresa)}`;
  return subject.length > 200 ? subject.slice(0, 199) + '…' : subject;
}

/** Corpo do e-mail em texto puro; os valores de linha única são normalizados. */
export function buildEmailText(data, now = new Date()) {
  const line = (label, v) => `${label}: ${normalizeLine(v) || '(não informado)'}`;
  const parts = [
    'Novo pedido de contato pelo site da IRON AI.',
    '',
    line('Motivo', data.motivo),
    line('Nome', data.nome),
    line('Cargo', data.cargo),
    line('Empresa', data.empresa),
    line('E-mail', data.email),
    line('Telefone', data.telefone),
    line('Porte', data.porte),
    `Consentimento LGPD: sim (${now.toISOString()})`,
    '',
    'Mensagem:',
    normalizeMultiline(data.mensagem) || '(sem mensagem)'
  ];
  return parts.join('\n');
}

/** Payload da API do Resend (POST https://api.resend.com/emails). */
export function buildEmail(data, env, now = new Date()) {
  return {
    from: normalizeLine(env.CONTACT_FROM),
    to: parseList(env.CONTACT_TO),
    reply_to: normalizeLine(data.email),
    subject: buildSubject(data),
    text: buildEmailText(data, now)
  };
}

/** fetch com AbortController e prazo; lança em timeout ou erro de rede. */
export async function fetchWithTimeout(url, options, timeoutMs = EXTERNAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Verifica o token no servidor. Retorna { ok, status, codes }.
 * Exige success === true e, se expectedHostname vier, hostname igual.
 */
export async function verifyTurnstile({ token, ip, secret, expectedHostname, timeoutMs }) {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  let res;
  try {
    res = await fetchWithTimeout(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }, timeoutMs);
  } catch (err) {
    return { ok: false, status: 0, codes: [err && err.name === 'AbortError' ? 'timeout' : 'network'] };
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok || !json || json.success !== true) {
    const codes = json && Array.isArray(json['error-codes']) ? json['error-codes'].slice(0, 5).map(String) : [];
    return { ok: false, status: res.status, codes };
  }
  if (expectedHostname && String(json.hostname || '').toLowerCase() !== expectedHostname.trim().toLowerCase()) {
    return { ok: false, status: res.status, codes: ['hostname-mismatch'] };
  }
  return { ok: true, status: res.status, codes: [] };
}

/** Envia pelo Resend. Retorna { ok, status }. */
export async function sendEmail(payload, { apiKey, timeoutMs }) {
  try {
    const res = await fetchWithTimeout(RESEND_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, timeoutMs);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, reason: err && err.name === 'AbortError' ? 'timeout' : 'network' };
  }
}
