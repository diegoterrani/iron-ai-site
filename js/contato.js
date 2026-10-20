/* =========================================================================
   IRON AI — contato.js
   Dois caminhos -> motivo do formulário; validação no cliente (espelho de
   api/_lib/contato-core.js: mudou lá, mude aqui); envio JSON para /api/contato
   com o token do Turnstile; estados de envio, sucesso e erro.
   Sem script inline (CSP).
   ========================================================================= */
(function () {
  'use strict';

  var form = document.querySelector('[data-contato-form]');
  if (!form) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var alertBox = form.querySelector('[data-form-alert]');
  var success = document.querySelector('[data-form-success]');
  var submit = form.querySelector('[data-submit]');
  var submitLabel = form.querySelector('[data-submit-label]');
  var counter = form.querySelector('[data-count]');
  var tsError = document.getElementById('turnstile-erro');

  /* ---------- regras (espelho do servidor) ---------- */
  var MOTIVOS = ['Sessão executiva', 'Deep-dive ou implementação', 'Parceria', 'Outro assunto'];
  var PORTES = ['até 49 pessoas', '50 a 249', '250 a 999', '1.000 ou mais'];
  var EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;
  var PHONE_RE = /^[0-9+().\s-]{8,30}$/;
  var MSG_MAX = 1000;

  function clean(v) { return String(v || '').trim().replace(/\s{2,}/g, ' '); }
  function text(min, max, label) {
    return function (v) {
      v = clean(v);
      if (!v) return 'Informe ' + label + '.';
      if (v.length < min) return 'Use pelo menos ' + min + ' caracteres.';
      if (v.length > max) return 'Use no máximo ' + max + ' caracteres.';
      return '';
    };
  }

  var rules = {
    motivo: function (v) { return MOTIVOS.indexOf(v) === -1 ? 'Selecione o motivo do contato.' : ''; },
    nome: text(2, 100, 'seu nome'),
    cargo: text(2, 100, 'seu cargo'),
    empresa: text(2, 120, 'o nome da empresa'),
    email: function (v) {
      v = clean(v);
      if (!v) return 'Informe seu e-mail corporativo.';
      if (v.length > 254 || !EMAIL_RE.test(v)) return 'Confira o e-mail: use o formato nome@empresa.com.br.';
      return '';
    },
    telefone: function (v) {
      v = clean(v);
      if (!v) return '';
      var d = v.replace(/\D/g, '').length;
      if (!PHONE_RE.test(v) || d < 8 || d > 15) return 'Confira o telefone: use DDD e número, só com dígitos.';
      return '';
    },
    porte: function (v) { return PORTES.indexOf(v) === -1 ? 'Selecione o porte da empresa.' : ''; },
    mensagem: function (v) {
      return String(v || '').replace(/\r\n?/g, '\n').trim().length > MSG_MAX ? 'Use no máximo 1.000 caracteres.' : '';
    },
    consentimento: function (_, el) { return el.checked ? '' : 'Marque a autorização para podermos responder.'; }
  };
  /* ordem do DOM: o foco vai ao primeiro campo inválido na ordem de leitura */
  var ORDER = ['motivo', 'porte', 'mensagem', 'nome', 'cargo', 'empresa', 'email', 'telefone', 'consentimento'];

  function field(name) { return form.elements[name]; }
  function errorEl(name) { return document.getElementById(field(name).id + '-erro'); }

  function setError(name, msg) {
    var el = field(name), err = errorEl(name);
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      err.textContent = msg;
      err.hidden = false;
    } else {
      el.removeAttribute('aria-invalid');
      err.textContent = '';
      err.hidden = true;
    }
  }

  function check(name) {
    var el = field(name);
    var msg = rules[name](el.value, el);
    setError(name, msg);
    return !msg;
  }

  /* validação no envio; depois do primeiro erro, o campo é revalidado a cada
     mudança. Sem validar no blur: a mensagem que surgiria deslocaria o botão
     de envio no meio do clique. */
  ORDER.forEach(function (name) {
    var el = field(name);
    var ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
  });

  /* ---------- contador da mensagem ---------- */
  var msgEl = field('mensagem');
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function updateCount() {
    var n = msgEl.value.length;
    counter.textContent = fmt(n) + ' / 1.000';
    counter.classList.toggle('is-near', n >= 900);
  }
  msgEl.addEventListener('input', updateCount);
  updateCount();

  /* ---------- dois caminhos -> motivo ---------- */
  var motivoEl = field('motivo');
  document.querySelectorAll('[data-motivo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      motivoEl.value = btn.getAttribute('data-motivo');
      motivoEl.dispatchEvent(new Event('change', { bubbles: true }));
      var target = document.getElementById('formulario');
      if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      /* o foco vai para o motivo já escolhido; o próximo Tab segue para o nome */
      motivoEl.focus({ preventScroll: true });
    });
  });

  /* ---------- Turnstile ---------- */
  function turnstileToken() {
    var input = form.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : '';
  }
  function resetTurnstile() {
    try { if (window.turnstile) window.turnstile.reset(); } catch (e) { /* widget ausente */ }
  }
  function setTsError(msg) {
    tsError.textContent = msg || '';
    tsError.hidden = !msg;
  }

  /* ---------- estados ---------- */
  function showAlert(msg) {
    alertBox.textContent = msg;
    alertBox.hidden = false;
  }
  function clearAlert() { alertBox.hidden = true; alertBox.textContent = ''; }
  function setBusy(on) {
    submit.disabled = on;
    submit.setAttribute('aria-busy', on ? 'true' : 'false');
    submitLabel.textContent = on ? 'Enviando…' : 'Enviar pedido';
    form.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  function showSuccess() {
    setBusy(false);                    /* botão e aria-busy limpos antes de esconder */
    form.hidden = true;
    success.hidden = false;
    success.focus();
  }

  var SERVER_FIELD_MSG = {
    'cf-turnstile-response': 'Confirme a verificação anti-robô.'
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearAlert();

    var firstInvalid = null;
    ORDER.forEach(function (name) {
      if (!check(name) && !firstInvalid) firstInvalid = field(name);
    });

    var token = turnstileToken();
    if (!token) {
      setTsError(window.turnstile
        ? 'Confirme a verificação anti-robô antes de enviar.'
        : 'A verificação anti-robô não carregou. Recarregue a página e tente de novo.');
    } else {
      setTsError('');
    }

    if (firstInvalid) { firstInvalid.focus(); return; }
    if (!token) { showAlert(tsError.textContent); return; }

    var body = {
      motivo: motivoEl.value,
      nome: clean(field('nome').value),
      cargo: clean(field('cargo').value),
      empresa: clean(field('empresa').value),
      email: clean(field('email').value),
      telefone: clean(field('telefone').value),
      porte: field('porte').value,
      mensagem: msgEl.value.replace(/\r\n?/g, '\n').trim(),
      consentimento: field('consentimento').checked === true,
      website: field('website').value,
      'cf-turnstile-response': token
    };

    setBusy(true);
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;

    fetch('/api/contato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
      })
      .then(function (r) {
        if (r.res.ok && r.data && r.data.ok) { showSuccess(); return; }
        var data = r.data || {};
        var first = null;
        (data.fields || []).forEach(function (name) {
          if (name === 'cf-turnstile-response') { setTsError(SERVER_FIELD_MSG[name]); return; }
          if (rules[name] && field(name)) {
            var el = field(name);
            setError(name, rules[name](el.value, el) || 'Confira este campo.');
            if (!first) first = el;
          }
        });
        showAlert(data.error || 'Não foi possível enviar agora. Tente de novo em alguns minutos.');
        resetTurnstile();
        setBusy(false);
        if (first) first.focus();
      })
      .catch(function () {
        showAlert('Não foi possível enviar agora. Confira a conexão e tente de novo.');
        resetTurnstile();
        setBusy(false);
      })
      .then(function () { if (timer) clearTimeout(timer); });
  });
})();
