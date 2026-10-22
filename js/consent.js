/* =========================================================================
   IRON AI — consent.js
   Consentimento de cookies (LGPD) e tag do Google Ads (gtag.js).
   - Nada é enviado ao Google antes do "Aceitar": gtag.js só é carregado
     depois do aceite (modo básico do Consent Mode v2).
   - Ao carregar, o estado de consentimento vai ao Google como default negado
     e, em seguida, update concedido só para publicidade (sem Analytics).
   - A escolha fica em localStorage por 12 meses; "Preferências de cookies"
     (botões [data-consent-open]) reabre o aviso e permite revogar.
   - Sem script inline (CSP); o aviso é montado com createElement/textContent.
   Expõe window.IronConsent: { open(), conversion(nome) }.
   ========================================================================= */
(function () {
  'use strict';

  var TAG_ID = 'AW-18531760156';
  /* rótulos das ações de conversão (Google Ads > Metas > Conversões).
     Vazio = evento desligado. Formato do send_to: TAG_ID + '/' + rótulo. */
  var CONVERSIONS = {
    contato: ''
  };

  var STORAGE_KEY = 'iron-consent';
  var VERSION = 1;                        /* mude para pedir o consentimento de novo */
  var MAX_AGE = 365 * 24 * 60 * 60 * 1000;
  var POLICY_URL = 'politica-de-privacidade.html#cookies';

  var loaded = false;
  var banner = null;

  /* ---------- armazenamento da escolha ---------- */
  function readChoice() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || c.v !== VERSION || (c.ads !== 'granted' && c.ads !== 'denied')) return null;
      if (typeof c.ts !== 'number' || Date.now() - c.ts > MAX_AGE) return null;
      return c.ads;
    } catch (e) {
      return null;                        /* storage bloqueado: pergunta de novo */
    }
  }
  function saveChoice(ads) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, ads: ads, ts: Date.now() }));
    } catch (e) { /* sem storage: a escolha vale só para esta página */ }
  }

  /* ---------- gtag ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function loadGtag() {
    if (loaded) return;
    loaded = true;
    window.gtag = gtag;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    gtag('js', new Date());
    gtag('config', TAG_ID);

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TAG_ID);
    document.head.appendChild(s);
  }

  /* revogação: avisa o Google e apaga os cookies próprios do Ads (_gcl_*) */
  function revoke() {
    if (loaded) {
      gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    var host = window.location.hostname;
    var domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (!/^_gcl_|^_gac_/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '') + '; SameSite=Lax; Secure';
      });
    });
  }

  function decide(ads) {
    var previous = readChoice();
    saveChoice(ads);
    if (ads === 'granted') loadGtag();
    else if (previous === 'granted' || loaded) revoke();
    close();
  }

  /* ---------- aviso ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function build() {
    var box = el('section', 'consent');
    box.setAttribute('aria-labelledby', 'consent-title');
    box.hidden = true;

    var title = el('p', 'consent__title', 'Cookies');
    title.id = 'consent-title';
    var text = el('p', 'consent__text',
      'Com a sua permissão, usamos cookies do Google Ads para medir os resultados dos nossos anúncios. Sem eles, o site funciona igual. ');
    var link = el('a', null, 'Saiba mais');
    link.href = POLICY_URL;
    text.appendChild(link);
    text.appendChild(document.createTextNode('.'));

    var actions = el('div', 'consent__actions');
    var reject = el('button', 'button button-small', 'Recusar');
    reject.type = 'button';
    reject.setAttribute('data-consent-choice', 'denied');
    var accept = el('button', 'button button-small', 'Aceitar');
    accept.type = 'button';
    accept.setAttribute('data-consent-choice', 'granted');
    reject.addEventListener('click', function () { decide('denied'); });
    accept.addEventListener('click', function () { decide('granted'); });
    actions.appendChild(reject);
    actions.appendChild(accept);

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(actions);
    document.body.appendChild(box);
    return box;
  }

  var returnFocus = null;
  function open(focus) {
    if (!banner) banner = build();
    banner.hidden = false;
    if (focus) {
      returnFocus = document.activeElement;
      banner.querySelector('button').focus();
    }
  }
  function close() {
    if (!banner) return;
    banner.hidden = true;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  /* ---------- conversões ---------- */
  function conversion(name) {
    var label = CONVERSIONS[name];
    if (!label || !loaded || readChoice() !== 'granted') return false;
    gtag('event', 'conversion', { send_to: TAG_ID + '/' + label });
    return true;
  }

  window.IronConsent = { open: function () { open(true); }, conversion: conversion };

  /* ---------- início ---------- */
  function init() {
    document.querySelectorAll('[data-consent-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { open(true); });
    });
    var choice = readChoice();
    if (choice === 'granted') loadGtag();
    else if (choice === null) open(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
