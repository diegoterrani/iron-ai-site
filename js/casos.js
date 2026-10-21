/* =========================================================================
   IRON AI — casos.js (casos-de-uso.html)
   Aprimora a versão empilhada do HTML; sem este arquivo tudo continua legível.
   1. Um só botão primário por vista: o CTA do header some enquanto o do topo
      ou o do fim está na tela (como setHeaderCta de home.js, sem depender dele).
   2. Movimento (só sem prefers-reduced-motion e com GSAP):
      - títulos e blocos [data-rise] entram de baixo, uma vez;
      - os 12 chips do método entram em sequência (stagger 50 ms), uma vez;
      - setores num palco fixo (pin) acima de 980 px: a rolagem escolhe o setor
        ativo (um só), a linha do índice se preenche e o painel novo sobe e
        cobre o anterior em 550 ms.
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

  /* método: os chips em sequência curta, de baixo para cima, uma vez */
  var chipsEl = document.querySelector('.chips');
  var chips = gsap.utils.toArray('[data-chip]');
  if (chipsEl && chips.length) {
    gsap.set(chips, { y: 22, opacity: 0 });
    ST.create({
      trigger: chipsEl,
      start: 'top 88%',
      once: true,
      onEnter: function () {
        gsap.to(chips, { y: 0, opacity: 1, duration: 0.5, ease: EASE, stagger: 0.05 });
      }
    });
  }

  /* ---------- setores: palco fixo ---------- */
  var sectorsEl = document.querySelector('[data-sectors]');
  if (!sectorsEl) return;
  var panels = gsap.utils.toArray('[data-sector]', sectorsEl);
  var items = gsap.utils.toArray('[data-sx-item]', sectorsEl);
  var fill = sectorsEl.querySelector('[data-sx-fill]');
  var n = panels.length;
  if (!n) return;

  var DUR = 0.55;                       /* troca de painel: 550 ms (barra 9: 300–700) */
  function stepLen() { return Math.round(window.innerHeight * 0.6); }
  function headerH() { return header ? header.offsetHeight : 84; }

  function setup() {
    sectorsEl.classList.add('is-pinned');
    /* o painel precisa caber inteiro no palco; se não couber (janela baixa), fica empilhado */
    var fits = panels.every(function (p) {
      var body = p.querySelector('.sector__body');
      return body && body.scrollHeight <= body.clientHeight + 1;
    });
    if (!fits) { sectorsEl.classList.remove('is-pinned'); return; }

    var current = 0;
    panels.forEach(function (p, i) { gsap.set(p, { zIndex: i + 1, yPercent: i === 0 ? 0 : 100 }); });

    function mark(j) {
      items.forEach(function (a, k) {
        var on = k === j;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    mark(0);

    /* j > atual: o painel j sobe e cobre; j < atual: o de cima desce e revela j */
    function go(j) {
      if (j === current) return;
      var from = current;
      current = j;
      mark(j);
      var mover = j > from ? j : from;
      panels.forEach(function (p, k) {
        gsap.killTweensOf(p);
        if (k === mover) return;
        gsap.set(p, { yPercent: k <= j ? 0 : 100 });
      });
      gsap.to(panels[mover], { yPercent: mover === j ? 0 : 100, duration: DUR, ease: EASE });
    }

    var st = ST.create({
      trigger: sectorsEl,
      start: function () { return 'top ' + headerH() + 'px'; },
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

    /* índice: leva a rolagem até o meio do trecho do setor */
    function onItem(e) {
      var k = items.indexOf(e.currentTarget);
      if (k < 0) return;
      e.preventDefault();
      var y = st.start + (k + 0.5) / n * (st.end - st.start);
      if (S.lenis) S.lenis.scrollTo(y, { duration: 0.9 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    }
    items.forEach(function (a) { a.addEventListener('click', onItem); });

    return function cleanup() {
      items.forEach(function (a) { a.removeEventListener('click', onItem); a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
      st.kill(true);
      panels.forEach(function (p) { gsap.killTweensOf(p); });
      gsap.set(panels, { clearProps: 'transform,zIndex' });
      if (fill) fill.style.transform = '';
      sectorsEl.classList.remove('is-pinned');
    };
  }

  /* acima de 980 px e com altura suficiente; abaixo, cartões empilhados */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 981px) and (min-height: 600px)', function () { return setup(); });

  if (S.fontsReady) S.fontsReady.then(function () { ST.refresh(); });
})();
