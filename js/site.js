/* =========================================================================
   IRON AI — site.js
   Comum a todas as páginas: detecção de movimento reduzido e toque, rolagem
   com inércia (Lenis) integrada ao GSAP ScrollTrigger, header, utilidades.
   Expõe window.IronSite para home.js, visuals.js e as próximas páginas.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqTouch = window.matchMedia('(hover: none) and (pointer: coarse)');
  var reducedMotion = mqReduce.matches;
  var isTouch = mqTouch.matches;
  if (reducedMotion) root.classList.add('reduced-motion');
  if (isTouch) root.classList.add('touch');

  /* ---------- utilidades ---------- */
  var util = {
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    /* interpolação exponencial independente da taxa de quadros */
    damp: function (a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); },
    smoothstep: function (a, b, v) {
      var t = util.clamp((v - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    map: function (v, a, b, c, d) { return c + (d - c) * util.clamp((v - a) / (b - a), 0, 1); },
    token: function (name, el) {
      return getComputedStyle(el || root).getPropertyValue(name).trim();
    },
    /* "#rrggbb" ou "#rrggbbaa" -> [r, g, b, a] */
    rgb: function (hex) {
      var h = String(hex).replace('#', '').trim();
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var n = parseInt(h.slice(0, 6), 16);
      var a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    },
    mix: function (c1, c2, t) {
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t)
      ];
    },
    css: function (c, a) {
      return a === undefined || a >= 1
        ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
        : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
    },
    debounce: function (fn, ms) {
      var t;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, ms);
      };
    }
  };

  /* ---------- GSAP + ScrollTrigger + Lenis ---------- */
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var hasGsap = !!(gsap && ScrollTrigger);
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* Guardas de roda: um módulo pode consumir um evento de rolagem antes do Lenis
     (ex.: o hero travado). Retornar false = evento consumido. */
  var wheelGuards = [];
  var lenis = null;

  if (!reducedMotion && hasGsap && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      virtualScroll: function (data) {
        for (var i = 0; i < wheelGuards.length; i++) {
          if (wheelGuards[i](data) === false) return false;
        }
        return true;
      }
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var scrollListeners = [];
  function emitScroll() {
    var y = lenis ? lenis.animatedScroll : window.scrollY;
    for (var i = 0; i < scrollListeners.length; i++) scrollListeners[i](y);
  }
  if (lenis) {
    lenis.on('scroll', emitScroll);
  } else {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; emitScroll(); });
    }, { passive: true });
  }

  /* ---------- header ---------- */
  var headerEl = document.querySelector('[data-header]');
  var header = {
    el: headerEl,
    setSolid: function (on) { if (headerEl) headerEl.classList.toggle('is-solid', !!on); },
    /* posição vertical do header em px (0 = encaixado no topo; negativo = acima
       da tela; positivo = mais abaixo, na borda da folha que sobe) */
    setY: function (y) {
      if (headerEl) headerEl.style.setProperty('--hdr-y', y + 'px');
    },
    /* fração visível da divisória inferior (0 = sem divisória, 1 = inteira) */
    setRule: function (v) {
      if (headerEl) headerEl.style.setProperty('--rule', v.toFixed(3));
    },
    height: function () { return headerEl ? headerEl.offsetHeight : 0; },
    closeMenu: function () {}
  };

  if (headerEl) {
    /* páginas sem hero sobreposto: header sólido desde o início */
    if (document.body.getAttribute('data-header-mode') !== 'overlay') header.setSolid(true);

    var toggle = headerEl.querySelector('[data-menu-toggle]');
    if (toggle) {
      var setOpen = function (open) {
        headerEl.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      };
      toggle.addEventListener('click', function () {
        setOpen(!headerEl.classList.contains('nav-open'));
      });
      header.closeMenu = function () { if (headerEl.classList.contains('nav-open')) setOpen(false); };
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && headerEl.classList.contains('nav-open')) { setOpen(false); toggle.focus(); }
      });
      headerEl.querySelectorAll('.site-nav a').forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
      });
    }
  }

  /* ---------- fontes ---------- */
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(function () {
    if (hasGsap && !reducedMotion) ScrollTrigger.refresh();
  });

  /* Preferência de movimento alterada com a página aberta: recarrega no modo certo. */
  var onReduceChange = function () { window.location.reload(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduceChange);

  window.IronSite = {
    util: util,
    gsap: gsap,
    ScrollTrigger: ScrollTrigger,
    hasGsap: hasGsap,
    lenis: lenis,
    reducedMotion: reducedMotion,
    isTouch: isTouch,
    header: header,
    fontsReady: fontsReady,
    addWheelGuard: function (fn) { wheelGuards.push(fn); },
    onScroll: function (fn) { scrollListeners.push(fn); },
    scrollY: function () { return lenis ? lenis.animatedScroll : window.scrollY; }
  };
})();
