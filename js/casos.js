/* =========================================================================
   IRON AI — casos.js (casos-de-uso.html)
   Aprimora a versão empilhada do HTML; sem este arquivo tudo continua legível.
   1. Um só botão primário por vista: o CTA do header some enquanto o do topo
      ou o do fim está na tela (como setHeaderCta de home.js, sem depender dele).
   2. Movimento (só sem prefers-reduced-motion e com GSAP):
      - títulos e blocos [data-rise] entram de baixo, uma vez;
      - setores num palco fixo (pin) acima de 980 px: a rolagem escolhe o setor
        ativo (um só), a linha do índice se preenche e o painel novo sobe e
        cobre o anterior em 550 ms; o índice troca quando o painel novo cobre
        metade; painéis que não são o ativo ficam inert; focar um item do
        índice leva a rolagem até o seu setor, assentado.
   3. Sem palco fixo (< 980 px, movimento reduzido, janela baixa): índice compacto
      preso sob o header enquanto os cartões passam ("0N / 06 · Setor" e linha de
      progresso); o cartão que cruza o meio da tela é o ativo (aria-current).
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

  /* ---------- 3. Índice compacto (funciona também com movimento reduzido) ---------- */
  var sectorsBox = document.querySelector('[data-sectors]');
  var mini = document.querySelector('[data-sx-mini]');
  if (sectorsBox && mini) {
    var cards = Array.prototype.slice.call(sectorsBox.querySelectorAll('[data-sector]'));
    var mNum = mini.querySelector('[data-sx-mini-num]');
    var mName = mini.querySelector('[data-sx-mini-name]');
    var mFill = mini.querySelector('[data-sx-mini-fill]');
    var miniIdx = -1;
    var setMini = function (k) {
      if (k === miniIdx || k < 0) return;
      miniIdx = k;
      var pinned = sectorsBox.classList.contains('is-pinned');
      cards.forEach(function (c, i) {
        /* no palco fixo o ativo é marcado pelo índice lateral */
        if (i === k && !pinned) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
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
    setMini(0);
    onMiniScroll();
    mini.hidden = false;
  }

  /* ---------- 2. Movimento ---------- */
  var gsap = S.gsap, ST = S.ScrollTrigger;
  if (S.reducedMotion || !S.hasGsap || !gsap || !ST) return;

  var EASE = 'power2.out';

  /* títulos e blocos: de baixo, uma vez (vizinhos que entram juntos, em sequência curta) */
  var rise = gsap.utils.toArray('[data-rise]');
  if (rise.length) {
    gsap.set(rise, { y: 28, opacity: 0 });
    ST.batch(rise, {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.06, overwrite: true });
      }
    });
  }

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
    }
    /* só o painel ativo fica na árvore de foco e de leitura; os cobertos ou fora do
       quadro ficam inert */
    function setInert(j) {
      panels.forEach(function (p, k) {
        if (k === j) p.removeAttribute('inert'); else p.setAttribute('inert', '');
      });
    }
    mark(0);
    setInert(0);

    /* j > atual: o painel j sobe e cobre; j < atual: o de cima desce e revela j.
       O índice troca quando a troca passa da metade. */
    function go(j) {
      if (j === current) return;
      var from = current;
      current = j;
      setInert(j);
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

    return function cleanup() {
      items.forEach(function (a) {
        a.removeEventListener('click', onItem); a.removeEventListener('focus', onFocus);
        a.classList.remove('is-active'); a.removeAttribute('aria-current');
      });
      st.kill(true);
      panels.forEach(function (p) { gsap.killTweensOf(p); p.removeAttribute('inert'); });
      gsap.set(panels, { clearProps: 'transform,zIndex' });
      if (fill) fill.style.transform = '';
      frame.style.removeProperty('--frame-h');
      sectorsEl.classList.remove('is-pinned');
    };
  }

  /* acima de 980 px e com altura suficiente; abaixo, cartões empilhados */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 981px) and (min-height: 600px)', function () { return setup(); });

  if (S.fontsReady) S.fontsReady.then(function () { ST.refresh(); });
})();
