/* =========================================================================
   IRON AI — esteira.js (só em esteira.html)
   O HTML base já é a versão completa e empilhada; este arquivo só aprimora.
   1. Um botão primário por vista: o "Agendar diagnóstico" do header some
      enquanto o CTA do hero ou o do CTA final estiver na tela (vale também com
      movimento reduzido: não é animação).
   2. Palco das cinco etapas (desktop >= 981px, altura >= 720px): ScrollTrigger
      prende o palco; a rolagem avança a etapa ativa (uma só, aria-current="step")
      e o painel novo sobe e cobre o anterior (yPercent 100 -> 0, 600 ms; na volta,
      desce em 500 ms). O trilho do índice se preenche com a rolagem.
   3. Visão geral: a linha 01 -> 05 se preenche com a rolagem ao entrar.
   (Sem animações de entrada: fora da cobertura dos painéis e dos indicadores de
   progresso, nada anima — design-system.md, Movimento.)
   Movimento reduzido ou sem GSAP: só o item 1; nada se move.
   Lenis vem de site.js (IronSite.lenis); aqui não se cria outro.
   ========================================================================= */
(function () {
  'use strict';
  var S = window.IronSite;
  if (!S) return;
  var U = S.util;

  /* 1. Um botão primário por vista ------------------------------------------ */
  var headerEl = S.header.el;
  var hdrCta = headerEl ? headerEl.querySelector('.site-header__cta') : null;
  var viewCtas = [].slice.call(document.querySelectorAll('[data-view-cta]'));
  var ctaShown = null;
  function updateHeaderCta() {
    if (!hdrCta) return;
    var hh = S.header.height(), vh = window.innerHeight, inView = false;
    for (var i = 0; i < viewCtas.length; i++) {
      var r = viewCtas[i].getBoundingClientRect();
      if (r.bottom > hh && r.top < vh) { inView = true; break; }
    }
    var show = !inView;
    if (show === ctaShown) return;
    ctaShown = show;
    /* mesma classe da home: .is-wide esconde o botão do header (site.css, seção 5) */
    headerEl.classList.toggle('is-wide', !show);
    hdrCta.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) hdrCta.removeAttribute('tabindex'); else hdrCta.setAttribute('tabindex', '-1');
  }
  S.onScroll(updateHeaderCta);
  window.addEventListener('resize', U.debounce(updateHeaderCta, 120));
  updateHeaderCta();

  /* 1b. Índice compacto (lista empilhada: < 980px, tela baixa ou movimento reduzido).
     Etapa ativa = último cartão cujo topo passou do meio da tela; uma só, com
     aria-current="step" no cartão e o rótulo em aria-live polite. A linha de
     progresso acompanha a rolagem pela lista (sem ela no movimento reduzido). */
  var mini = document.querySelector('[data-mini]');
  var miniStage = document.querySelector('[data-stage]');
  var miniList = document.querySelector('[data-panels]');
  if (mini && miniStage && miniList) {
    var cards = [].slice.call(miniList.querySelectorAll('[data-panel]'));
    var mNum = mini.querySelector('[data-mini-num]');
    var mName = mini.querySelector('[data-mini-name]');
    var mFill = mini.querySelector('[data-mini-fill]');
    var mActive = -1, mOn = null;
    var miniUpdate = function () {
      var on = !miniStage.classList.contains('is-pinned');
      if (on !== mOn) {
        mOn = on;
        mini.hidden = !on;
        miniList.classList.toggle('is-tracked', on);
        document.documentElement.classList.toggle('es-tracked', on);
        if (!on) { cards.forEach(function (c) { c.removeAttribute('aria-current'); }); mActive = -1; }
      }
      if (!on) return;
      var mid = window.innerHeight / 2, k = 0;
      for (var i = 0; i < cards.length; i++) if (cards[i].getBoundingClientRect().top <= mid) k = i;
      /* foco de teclado num cartão visível: o estado é o desse cartão */
      var fc = document.activeElement && document.activeElement.closest ? document.activeElement.closest('[data-panel]') : null;
      if (fc) {
        var fr = fc.getBoundingClientRect();
        if (fr.bottom > 0 && fr.top < window.innerHeight) k = cards.indexOf(fc);
      }
      if (k !== mActive) {
        mActive = k;
        cards.forEach(function (c, j) { if (j === k) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); });
        mNum.textContent = '0' + (k + 1);
        mName.textContent = cards[k].querySelector('.es-panel__name').textContent;
      }
      if (!S.reducedMotion && mFill) {
        var r = miniList.getBoundingClientRect();
        mFill.style.setProperty('--m', U.clamp((mid - r.top) / r.height, 0, 1).toFixed(4));
      }
    };
    S.onScroll(miniUpdate);
    window.addEventListener('resize', U.debounce(miniUpdate, 120));
    /* foco de teclado: nada fica sob o header + faixa presa (depois da rolagem nativa
       do foco, corrige o que ainda ficou coberto) e o estado passa ao cartão focado */
    document.addEventListener('focusin', function (e) {
      if (!mOn) return;
      var el = e.target;
      requestAnimationFrame(function () {
        if (document.activeElement !== el) return;
        var hh = S.header.height(), mr = mini.getBoundingClientRect();
        var stuck = !mini.hidden && mr.top <= hh + 1 && mr.bottom > hh;
        var limit = (stuck ? mr.bottom : hh) + 22;
        var r = el.getBoundingClientRect();
        if (r.top < limit && r.bottom > 0) {
          var y = Math.round(S.scrollY() - (limit - r.top));
          if (S.lenis) S.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
        }
        miniUpdate();
      });
    });
    miniUpdate();
    /* troca de modo (palco preso <-> lista) sem rolagem */
    if (window.MutationObserver) new MutationObserver(miniUpdate).observe(miniStage, { attributes: true, attributeFilter: ['class'] });
  }

  if (S.reducedMotion || !S.hasGsap) return;
  var gsap = S.gsap, ST = S.ScrollTrigger;

  function scrollToY(y, done) {
    if (S.lenis) S.lenis.scrollTo(y, { duration: 0.9, onComplete: done });
    else { window.scrollTo({ top: y, behavior: 'smooth' }); if (done) setTimeout(done, 900); }
  }

  /* 2. Palco das cinco etapas ------------------------------------------------ */
  var stage = document.querySelector('[data-stage]');
  var panels = stage ? [].slice.call(stage.querySelectorAll('[data-panel]')) : [];
  var links = stage ? [].slice.call(stage.querySelectorAll('[data-index-link]')) : [];
  var fill = stage ? stage.querySelector('[data-index-fill]') : null;
  var N = panels.length;
  var pin = null;          /* ScrollTrigger do palco, só enquanto preso */
  var active = -1;

  var UP = { duration: 0.6, ease: 'power3.out', overwrite: true };
  var DOWN = { duration: 0.5, ease: 'power2.inOut', overwrite: true };

  function setActive(i, instant) {
    /* instant: assenta já (mata as coberturas em curso), mesmo se i já for o ativo */
    if (i === active && !instant) return;
    active = i;
    links.forEach(function (a, k) {
      if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    /* painéis até o ativo ficam em 0 (os de baixo cobertos pelo de cima, que vem
       depois no DOM); os seguintes ficam abaixo da janela (yPercent 100) */
    panels.forEach(function (p, k) {
      var target = k <= i ? 0 : 100;
      if (instant) { gsap.set(p, { yPercent: target, overwrite: true }); return; }
      if (gsap.getProperty(p, 'yPercent') === target) return;
      gsap.to(p, Object.assign({ yPercent: target }, target === 0 ? UP : DOWN));
    });
  }

  /* posição de rolagem que mostra a etapa k (meio do trecho dela) */
  function stepY(k) {
    return pin.start + (pin.end - pin.start) * (k + 0.5) / N;
  }

  /* altura do painel = a do conteúdo do painel mais alto (sem vão morto na coluna);
     gravada em --panel-h antes de cada cálculo do ScrollTrigger */
  var panelsBox = stage ? stage.querySelector('[data-panels]') : null;
  function measurePanels() {
    if (!pin && !stage.classList.contains('is-pinned')) return;
    var h = 0;
    panels.forEach(function (p) {
      var body = p.querySelector('.es-panel__body'), last = body && body.lastElementChild;
      if (!last) return;
      var pb = parseFloat(getComputedStyle(body).paddingBottom) || 0;
      h = Math.max(h, last.offsetTop + last.offsetHeight + pb);
    });
    if (h) panelsBox.style.setProperty('--panel-h', Math.ceil(h + 2) + 'px');
  }

  if (stage && N) {
    var mm = gsap.matchMedia();
    ST.addEventListener('refreshInit', measurePanels);
    mm.add('(min-width: 981px) and (min-height: 720px)', function () {
      stage.classList.add('is-pinned');
      /* alvo de foco do painel ao escolher a etapa pelo índice */
      panels.forEach(function (p) { p.setAttribute('tabindex', '-1'); });
      active = -1;
      setActive(0, true);
      measurePanels();
      pin = ST.create({
        trigger: stage,
        /* o palco (só o conteúdo, sem altura de tela) prende centrado na área sob o
           header: nada de faixa vazia presa junto, nem sobra quando solta */
        start: function () {
          var hh = S.header.height(), free = window.innerHeight - hh - stage.offsetHeight;
          return 'top ' + Math.round(hh + Math.max(24, free / 2)) + 'px';
        },
        /* 1,05 × a altura da tela de rolagem por etapa: um PageDown/PageUp (< 1 tela)
           nunca pula uma etapa */
        end: function () { return '+=' + Math.round(window.innerHeight * 1.05 * N); },
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        refreshPriority: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          if (fill) fill.style.setProperty('--p', self.progress.toFixed(4));
          setActive(Math.min(N - 1, Math.floor(self.progress * N)));
        },
        onRefresh: function (self) {
          if (fill) fill.style.setProperty('--p', self.progress.toFixed(4));
          setActive(Math.min(N - 1, Math.floor(self.progress * N)), true);
        }
      });
      return function () {
        pin = null;
        active = -1;
        stage.classList.remove('is-pinned');
        gsap.killTweensOf(panels);
        gsap.set(panels, { clearProps: 'transform' });
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        panels.forEach(function (p) { p.removeAttribute('tabindex'); });
        if (panelsBox) panelsBox.style.removeProperty('--panel-h');
        if (fill) fill.style.removeProperty('--p');
      };
    });

    /* links para as etapas (índice e linha do tempo): com o palco preso, rolam até
       o trecho da etapa em vez de saltar para a âncora */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#etapa-"]');
      if (!a || !pin) return;
      var k = panels.findIndex(function (p) { return '#' + p.id === a.getAttribute('href'); });
      if (k < 0) return;
      e.preventDefault();
      /* chegando à etapa, o foco passa ao painel: o próximo Tab entra nos links dele */
      scrollToY(stepY(k), function () {
        if (pin && active === k) panels[k].focus({ preventScroll: true });
      });
    });
    /* teclado: todos os painéis ficam na ordem de tabulação e na árvore de
       acessibilidade. Foco dentro de um painel (Tab, Shift+Tab)
       leva a rolagem à posição em que esse painel é o ativo e está assentado — não
       à posição do elemento no DOM, que o navegador usaria. O painel é assentado na
       hora (sem a cobertura animada) e a rolagem é refeita no quadro seguinte, depois
       da rolagem nativa do foco. */
    var settleOn = function (k) {
      if (!pin) return;
      var y = Math.round(stepY(k));
      if (S.lenis) S.lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      setActive(k, true);
      ST.update();
    };
    panels.forEach(function (p, k) {
      p.addEventListener('focusin', function () {
        if (!pin) return;
        settleOn(k);
        requestAnimationFrame(function () { settleOn(k); });
      });
    });
  }

  /* 3. Linha do tempo da visão geral ------------------------------------------ */
  var line = document.querySelector('[data-line]');
  if (line) {
    var items = [].slice.call(line.children);
    var applyFill = function (p) {
      line.style.setProperty('--fill', p.toFixed(4));
      items.forEach(function (li, k) { li.classList.toggle('is-on', p >= k / items.length - 0.0001 && p > 0); });
    };
    line.classList.add('is-live');
    ST.create({
      trigger: line,
      start: 'top 88%',
      end: 'top 48%',
      onUpdate: function (self) { applyFill(self.progress); },
      onRefresh: function (self) { applyFill(self.progress); }
    });
  }

  ST.sort();
  /* âncora de etapa na URL com o palco preso: abre na etapa pedida */
  S.fontsReady.then(function () {
    ST.refresh();
    var m = /^#etapa-0([1-5])$/.exec(window.location.hash);
    if (m && pin) {
      var y = stepY(+m[1] - 1);
      if (S.lenis) S.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    }
  });
})();
