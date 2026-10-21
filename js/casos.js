/* =========================================================================
   IRON AI — casos.js (casos-de-uso.html)
   Aprimora a versão empilhada do HTML; sem este arquivo tudo continua legível.
   1. Um só botão primário por vista: o CTA do header some enquanto o do topo
      ou o do fim está na tela (como setHeaderCta de home.js, sem depender dele).
   2. Movimento (só sem prefers-reduced-motion e com GSAP). Nada entra por
      animação (design system: fora das camadas que cobrem, nada anima):
      - setores num palco fixo (pin) acima de 980 px: a rolagem escolhe o setor
        ativo (um só), a linha do índice se preenche e o painel novo sobe e
        cobre o anterior em 550 ms; o índice troca quando o painel novo cobre
        metade; focar um item do
        índice leva a rolagem até o seu setor, assentado.
   3. Sem palco fixo (< 980 px, movimento reduzido, janela baixa): índice compacto
      preso sob o header enquanto os cartões passam ("0N / 06 · Setor" e linha de
      progresso); o cartão que cruza o meio da tela é o ativo.
   Em todos os modos há um só aria-current="true" num artigo de setor: o do setor
   ativo, trocado no mesmo ponto em que o índice troca (setCurrent).
   Usa window.IronSite (site.js): GSAP, ScrollTrigger e o Lenis já criados.
   ========================================================================= */
(function () {
  'use strict';

  var S = window.IronSite || {};
  var header = document.querySelector('[data-header]');

  /* ---------- 1. CTA do header ---------- */
  var hdrCta = document.querySelector('[data-header-cta]');
  var primaries = Array.prototype.slice.call(document.querySelectorAll('[data-cta-primary]'));
  var ctaShown = null;
  function setHeaderCta(show) {
    if (!header || !hdrCta || ctaShown === show) return;
    ctaShown = show;
    header.classList.toggle('cta-off', !show);
    if (show) hdrCta.removeAttribute('tabindex'); else hdrCta.setAttribute('tabindex', '-1');
    hdrCta.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  if (header && hdrCta && primaries.length) {
    var inView = primaries.map(function () { return false; });
    /* começa oculto: no carregamento o CTA do topo está na tela */
    setHeaderCta(false);
    if ('IntersectionObserver' in window) {
      var hh = header.offsetHeight || 84;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var i = primaries.indexOf(e.target);
          if (i > -1) inView[i] = e.isIntersecting;
        });
        setHeaderCta(inView.indexOf(true) === -1);
      }, { rootMargin: '-' + hh + 'px 0px 0px 0px', threshold: 0 });
      primaries.forEach(function (el) { io.observe(el); });
    } else {
      setHeaderCta(true);
    }
  }

  /* ---------- aria-current: um só artigo de setor ---------- */
  var sectorsBox = document.querySelector('[data-sectors]');
  var allCards = sectorsBox ? Array.prototype.slice.call(sectorsBox.querySelectorAll('[data-sector]')) : [];
  function setCurrent(k) {
    allCards.forEach(function (c, i) {
      if (i === k) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
  }
  var miniRefresh = function () {};

  /* ---------- 3. Índice compacto (funciona também com movimento reduzido) ---------- */
  var mini = document.querySelector('[data-sx-mini]');
  if (sectorsBox && mini) {
    var cards = Array.prototype.slice.call(sectorsBox.querySelectorAll('[data-sector]'));
    var mNum = mini.querySelector('[data-sx-mini-num]');
    var mName = mini.querySelector('[data-sx-mini-name]');
    var mFill = mini.querySelector('[data-sx-mini-fill]');
    var miniIdx = -1;
    var setMini = function (k) {
      /* no palco fixo quem decide é o índice lateral (mark) */
      if (k === miniIdx || k < 0 || sectorsBox.classList.contains('is-pinned')) return;
      miniIdx = k;
      setCurrent(k);
      mNum.textContent = String(k + 1).padStart(2, '0');
      var t = cards[k].querySelector('.sector__name');
      mName.textContent = t ? t.textContent : '';
    };
    /* progresso: do topo do primeiro cartão até o fim do último passar pelo meio da tela */
    var frameBox = sectorsBox.querySelector('[data-sectors-frame]');
    var onMiniScroll = function () {
      if (sectorsBox.classList.contains('is-pinned')) return;
      var r = frameBox.getBoundingClientRect(), mid = window.innerHeight / 2;
      var p = (mid - r.top) / Math.max(1, r.height);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      mFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      /* ativo = o cartão que cruza a linha do meio da tela; antes do primeiro, o
         primeiro; depois do último, o último (vale também para saltos de rolagem) */
      var k = 0;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].getBoundingClientRect().top <= mid) k = i; else break;
      }
      setMini(k);
    };
    /* rolagem nativa (saltos, âncoras) e a do Lenis */
    window.addEventListener('scroll', onMiniScroll, { passive: true });
    if (S.onScroll) S.onScroll(onMiniScroll);
    window.addEventListener('resize', onMiniScroll);
    miniRefresh = function () { miniIdx = -1; onMiniScroll(); };
    /* foco por teclado dentro de um cartão: a rolagem leva o topo do cartão até a linha
       do meio (na hora), e ele passa a ser o ativo da faixa e do aria-current */
    sectorsBox.addEventListener('focusin', function (e) {
      if (sectorsBox.classList.contains('is-pinned')) return;
      var c = e.target.closest && e.target.closest('[data-sector]');
      if (!c) return;
      requestAnimationFrame(function () {
        var mid = window.innerHeight / 2, top = c.getBoundingClientRect().top;
        var k = cards.indexOf(c), next = cards[k + 1];
        var dy = 0;
        if (top > mid) dy = top - mid + 2;
        else if (next && next.getBoundingClientRect().top <= mid) dy = next.getBoundingClientRect().top - mid - 2;
        if (dy) {
          if (S.lenis) S.lenis.scrollTo(window.scrollY + dy, { immediate: true, force: true });
          else window.scrollBy(0, dy);
        }
        onMiniScroll();
      });
    });
    onMiniScroll();
    mini.hidden = false;
  }

  /* ---------- 2. Movimento ---------- */
  var gsap = S.gsap, ST = S.ScrollTrigger;
  if (S.reducedMotion || !S.hasGsap || !gsap || !ST) return;

  var EASE = 'power2.out';

  /* ---------- setores: palco fixo ---------- */
  var sectorsEl = sectorsBox;
  if (!sectorsEl) return;
  var panels = gsap.utils.toArray('[data-sector]', sectorsEl);
  var items = gsap.utils.toArray('[data-sx-item]', sectorsEl);
  var fill = sectorsEl.querySelector('[data-sx-fill]');
  var n = panels.length;
  if (!n) return;

  var DUR = 0.55;                       /* troca de painel: 550 ms (barra 9: 300–700) */
  function stepLen() { return Math.round(window.innerHeight * 0.6); }
  function headerH() { return header ? header.offsetHeight : 84; }

  var MIN_FRAME = 540;                  /* altura mínima da moldura: a figura precisa de campo */

  function setup() {
    sectorsEl.classList.add('is-pinned');
    var frame = sectorsEl.querySelector('[data-sectors-frame]');
    /* altura natural do painel mais alto (corpo com a moldura encolhida: scrollHeight
       = conteúdo); a moldura fica com ela, sem vazio no pé da coluna de texto */
    frame.style.setProperty('--frame-h', '1px');
    var need = 0;
    panels.forEach(function (p) {
      var body = p.querySelector('.sector__body');
      need = Math.max(need, body ? body.scrollHeight + 2 : 0);
    });
    frame.style.removeProperty('--frame-h');
    /* área útil: entre o header e o pé da tela, com space-4 de folga em cima e embaixo */
    var avail = window.innerHeight - headerH() - 64;
    if (!need || need > avail) { sectorsEl.classList.remove('is-pinned'); return; }
    frame.style.setProperty('--frame-h', Math.min(avail, Math.max(need, MIN_FRAME)) + 'px');
    /* o palco (altura do conteúdo) fica preso no meio da área abaixo do header */
    function pinTop() {
      var free = window.innerHeight - headerH() - sectorsEl.offsetHeight;
      return Math.round(headerH() + Math.max(32, free / 2));
    }

    var current = 0;
    panels.forEach(function (p, i) { gsap.set(p, { zIndex: i + 1, yPercent: i === 0 ? 0 : 100 }); });

    function mark(j) {
      items.forEach(function (a, k) {
        var on = k === j;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      setCurrent(j);
    }
    /* todos os painéis ficam na árvore de leitura (sem inert): o leitor de tela lê os
       seis em sequência; o foco por teclado leva a rolagem ao setor (onFocus) */
    mark(0);

    /* j > atual: o painel j sobe e cobre; j < atual: o de cima desce e revela j.
       O índice troca quando a troca passa da metade. */
    function go(j) {
      if (j === current) return;
      var from = current;
      current = j;
      var mover = j > from ? j : from;
      panels.forEach(function (p, k) {
        gsap.killTweensOf(p);
        if (k === mover) return;
        gsap.set(p, { yPercent: k <= j ? 0 : 100 });
      });
      var marked = false;
      gsap.to(panels[mover], {
        yPercent: mover === j ? 0 : 100, duration: DUR, ease: EASE,
        onUpdate: function () {
          /* ratio = posição já com a curva: o índice troca com metade coberta */
          if (!marked && this.ratio >= 0.5) { marked = true; mark(j); }
        },
        onComplete: function () { if (!marked) mark(j); }
      });
    }

    var st = ST.create({
      trigger: sectorsEl,
      start: function () { return 'top ' + pinTop() + 'px'; },
      end: function () { return '+=' + (n * stepLen()); },
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        if (fill) fill.style.transform = 'scaleY(' + self.progress.toFixed(4) + ')';
        go(Math.min(n - 1, Math.floor(self.progress * n)));
      }
    });

    /* posição em que o setor k está ativo e assentado: o meio do seu trecho */
    function yFor(k) { return Math.round(st.start + (k + 0.5) / n * (st.end - st.start)); }
    function scrollToSector(k, smooth) {
      var y = yFor(k);
      if (S.lenis) S.lenis.scrollTo(y, smooth ? { duration: 0.9 } : { immediate: true, force: true });
      else window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
    }
    function onItem(e) {
      var k = items.indexOf(e.currentTarget);
      if (k < 0) return;
      e.preventDefault();
      scrollToSector(k, true);
    }
    /* foco pelo teclado num item do índice: a página vai direto ao trecho do setor
       (o palco preso fica inteiro abaixo do header, com o painel do item na frente) */
    function onFocus(e) {
      var k = items.indexOf(e.currentTarget);
      if (k < 0 || !e.currentTarget.matches(':focus-visible')) return;
      var y = S.scrollY ? S.scrollY() : window.scrollY;
      if (Math.abs(y - yFor(k)) > (st.end - st.start) / n / 2) scrollToSector(k, false);
    }
    items.forEach(function (a) { a.addEventListener('click', onItem); a.addEventListener('focus', onFocus); });
    /* qualquer elemento focável que venha a existir dentro de um painel: a rolagem vai
       na hora até o setor dele, com o painel na frente e assentado */
    function onPanelFocus(e) {
      var p = e.target.closest && e.target.closest('[data-sector]');
      var k = p ? panels.indexOf(p) : -1;
      if (k < 0 || k === current) return;
      scrollToSector(k, false);
    }
    sectorsEl.addEventListener('focusin', onPanelFocus);

    return function cleanup() {
      items.forEach(function (a) {
        a.removeEventListener('click', onItem); a.removeEventListener('focus', onFocus);
        a.classList.remove('is-active'); a.removeAttribute('aria-current');
      });
      sectorsEl.removeEventListener('focusin', onPanelFocus);
      st.kill(true);
      panels.forEach(function (p) { gsap.killTweensOf(p); });
      gsap.set(panels, { clearProps: 'transform,zIndex' });
      if (fill) fill.style.transform = '';
      frame.style.removeProperty('--frame-h');
      sectorsEl.classList.remove('is-pinned');
      miniRefresh();
    };
  }

  /* acima de 980 px e com altura suficiente; abaixo, cartões empilhados */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 981px) and (min-height: 600px)', function () { return setup(); });

  if (S.fontsReady) S.fontsReady.then(function () { ST.refresh(); });
})();
