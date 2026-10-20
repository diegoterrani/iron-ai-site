/* =========================================================================
   IRON AI — POST /api/contato (função serverless da Vercel, Node 20).
   Fluxo: método -> configuração -> Content-Type -> Origin/Referer -> tamanho
   -> JSON -> honeypot -> validação -> Turnstile -> Resend.
   Sem dependências: fetch nativo. Respostas genéricas ({ ok, error }), sem stack.
   Logs em JSON sem dados pessoais (só motivo, porte, resultado e status).
   ========================================================================= */
import {
  MAX_BODY_BYTES, EXTERNAL_TIMEOUT_MS, missingEnv, isOriginAllowed, isHoneypotFilled,
  validateContato, clientIp, verifyTurnstile, buildEmail, sendEmail, MOTIVOS, PORTES
} from './_lib/contato-core.js';

const MSG = {
  method: 'Método não permitido.',
  config: 'Serviço indisponível no momento.',
  type: 'Formato de envio não aceito.',
  origin: 'Origem não autorizada.',
  size: 'Pedido grande demais.',
  json: 'Pedido inválido.',
  invalid: 'Revise os campos destacados.',
  turnstile: 'Não foi possível confirmar a verificação anti-robô. Tente de novo.',
  send: 'Não foi possível enviar agora. Tente de novo em alguns minutos.',
  ok: 'Pedido recebido.'
};

function log(event, fields = {}) {
  console.log(JSON.stringify({ evt: event, route: '/api/contato', ...fields }));
}

function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

class BodyTooLarge extends Error {}

/* Lê o corpo cru com limite. Se o runtime já tiver consumido o stream
   (helpers da Vercel), usa req.body e mede o tamanho serializado. */
async function readBody(req, limit) {
  const readable = typeof req.on === 'function' && req.readable !== false && !req.readableEnded;
  if (readable) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > limit) throw new BodyTooLarge();
      chunks.push(buf);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  const b = req.body;
  const text = b === undefined || b === null ? '' : Buffer.isBuffer(b) ? b.toString('utf8') : typeof b === 'string' ? b : JSON.stringify(b);
  if (Buffer.byteLength(text) > limit) throw new BodyTooLarge();
  return text;
}

async function handle(req, res) {
  const headers = req.headers || {};

  if (req.method !== 'POST') {
    log('rejected', { reason: 'method', status: 405 });
    return send(res, 405, { ok: false, error: MSG.method }, { Allow: 'POST' });
  }

  const env = process.env;
  const missing = missingEnv(env);
  if (missing.length) {
    for (const name of missing) log('config_missing', { variable: name });
    return send(res, 500, { ok: false, error: MSG.config });
  }

  const ctype = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (ctype !== 'application/json') {
    log('rejected', { reason: 'content_type', status: 415 });
    return send(res, 415, { ok: false, error: MSG.type });
  }

  if (!isOriginAllowed(headers, env.ALLOWED_ORIGINS)) {
    log('rejected', { reason: 'origin', status: 403 });
    return send(res, 403, { ok: false, error: MSG.origin });
  }

  const declared = Number(headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    log('rejected', { reason: 'size', status: 413 });
    return send(res, 413, { ok: false, error: MSG.size });
  }

  let input;
  try {
    const raw = await readBody(req, MAX_BODY_BYTES);
    input = JSON.parse(raw);
  } catch (err) {
    if (err instanceof BodyTooLarge) {
      log('rejected', { reason: 'size', status: 413 });
      return send(res, 413, { ok: false, error: MSG.size });
    }
    log('rejected', { reason: 'json', status: 400 });
    return send(res, 400, { ok: false, error: MSG.json });
  }

  /* bot: resposta igual à de sucesso, nada é enviado */
  if (isHoneypotFilled(input)) {
    log('honeypot', { status: 200 });
    return send(res, 200, { ok: true, message: MSG.ok });
  }

  const result = validateContato(input);
  if (!result.ok) {
    /* só os nomes dos campos permitidos voltam ao cliente; chaves desconhecidas viram "_body" */
    const known = new Set(['motivo', 'nome', 'cargo', 'empresa', 'email', 'telefone', 'porte', 'mensagem', 'consentimento', 'cf-turnstile-response']);
    const fields = [...new Set(Object.keys(result.errors).map((k) => (known.has(k) ? k : '_body')))];
    log('invalid', { status: 400, fields });
    return send(res, 400, { ok: false, error: MSG.invalid, fields });
  }

  const data = result.data;
  /* motivo e porte são valores fixos da allowlist: seguros para log */
  const safe = { motivo: MOTIVOS.includes(data.motivo) ? data.motivo : null, porte: PORTES.includes(data.porte) ? data.porte : null };

  const ts = await verifyTurnstile({
    token: data.token,
    ip: clientIp(headers),
    secret: env.TURNSTILE_SECRET_KEY,
    expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME || '',
    timeoutMs: EXTERNAL_TIMEOUT_MS
  });
  if (!ts.ok) {
    log('turnstile_failed', { ...safe, status: 403, upstream: ts.status, codes: ts.codes });
    return send(res, 403, { ok: false, error: MSG.turnstile });
  }

  const mail = await sendEmail(buildEmail(data, env), { apiKey: env.RESEND_API_KEY, timeoutMs: EXTERNAL_TIMEOUT_MS });
  if (!mail.ok) {
    log('send_failed', { ...safe, status: 502, upstream: mail.status, reason: mail.reason || null });
    return send(res, 502, { ok: false, error: MSG.send });
  }

  log('sent', { ...safe, status: 200, upstream: mail.status });
  return send(res, 200, { ok: true, message: MSG.ok });
}

/* ponto de entrada: qualquer falha inesperada vira 500 genérico, sem stack */
export default async function handler(req, res) {
  try {
    return await handle(req, res);
  } catch (err) {
    log('error', { status: 500, kind: err && err.name ? String(err.name) : 'Error' });
    if (!res.headersSent) return send(res, 500, { ok: false, error: MSG.config });
  }
}
