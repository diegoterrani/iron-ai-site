/* =========================================================================
   IRON AI — home.js
   Coreografia da home, parte 1:
   - Hero com rolagem travada e mídia que expande (barra 1 e 7).
       modo "locked": mouse/trackpad. Os primeiros ~700 px de roda não rolam a
         página; alimentam o progresso do hero (interpolado). A página só volta a
         rolar com a expansão completa; no topo, rolar para cima recolhe.
       modo "scroll": telas de toque. A expansão fica ligada à rolagem normal
         (hero fixo + 90vh de espaço de rolagem).
       modo "static": prefers-reduced-motion. Nada travado, nada coreografado.
   - Passagem hero -> manifesto: o manifesto cobre o hero (barra 6).
   - Manifesto que acende palavra por palavra com a leitura (barra 2).
   Tudo ligado à posição: o mesmo quadro na mesma posição, descendo ou subindo.
   ========================================================================= */
(function () {
  'use strict';

  var S = window.IronSite;
  if (!S) return;
  var U = S.util;
  var gsap = S.gsap;
  var ST = S.ScrollTrigger;
  var root = document.documentElement;

  var stage = document.querySelector('[data-hero-stage]');
  var canvas = document.querySelector('[data-hero-canvas]');
  var halfA = document.querySelector('[data-hero-half="a"]');
  var halfB = document.querySelector('[data-hero-half="b"]');
  var eyebrow = document.querySelector('[data-hero-meta="top"]');
  var foot = document.querySelector('[data-hero-meta="bottom"]');
  var spacer = document.querySelector('[data-hero-spacer]');
  var manifesto = document.querySelector('[data-manifesto]');
  var revealEl = document.querySelector('[data-reveal]');
  if (!stage || !halfA || !halfB || !eyebrow || !foot) return;
  var lead = foot.querySelector('.home-hero__lead');
  var heroCta = foot.querySelector('.button');
  var actions = foot.querySelector('.home-hero__actions');

  var mode = (S.reducedMotion || !S.hasGsap) ? 'static' : ((S.isTouch || !S.lenis) ? 'scroll' : 'locked');
  root.classList.toggle('hero-scroll', mode === 'scroll');
  root.classList.toggle('hero-locked', mode === 'locked');

  /* ---------------------------------------------------------------------
     Geometria do hero (medida, não estimada). Todo texto fica sobre paper.
     - desktop/telas largas ("flank"): mídia centrada, 45% da largura e até 65%
       da altura; coluna esquerda = eyebrow (topo alinhado ao da mídia) + 1ª
       metade; coluna direita = 2ª metade + texto e ação (ancorados embaixo).
       O título é dimensionado para caber na coluna sem tocar eyebrow nem ação.
     - retrato ("stack"): eyebrow e 1ª metade acima; 2ª metade, texto e ação
       abaixo; mídia com 70% (celular) ou 60% (tablet) da largura.
     - cena de fundo: grade de hairlines `line` sobre paper em todo o palco, atrás
       do texto também (visuals.js, drawScene); a mídia é um cartão dentro dela e a
       cobre ao crescer. Nada some por opacidade.
     offsetTop/offsetWidth ignoram transformações.
     --------------------------------------------------------------------- */
  var heroStart = { w: 0.45, h: 0.65, cy: 0.5 };
  var geo = null;

  function px(v) { return (Math.round(v * 100) / 100) + 'px'; }
  function gutterFor(W) { return W <= 640 ? 22 : Math.max(W * 0.06, W / 2 - 620); }

  /* corpo do h2 do manifesto (section-title) na largura atual */
  function sectionTitleSize() {
    var h2 = revealEl || document.querySelector('.manifesto__title');
    return h2 ? parseFloat(getComputedStyle(h2).fontSize) || 36 : 36;
  }

  function measureHero() {
    var W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return heroStart;
    var hdr = S.header.height() || 84;
    var g = gutterFor(W);
    var hm = Math.max(g, W <= 640 ? 22 : 32);      /* margem do palco em repouso: space-4 / space-3 */
    /* h1 do hero: nunca abaixo de 48px e sempre maior que o section-title da mesma largura */
    var minH1 = Math.max(48, Math.ceil(sectionTitleSize() + 2));
    var landscape = W >= 600 && W / H >= 0.9;
    var gapT = U.clamp(W * 0.03, 28, 56);
    var hg = Math.max(U.clamp(W * 0.03, 24, 64), 32);   /* margem do palco no lado a lado: >= space-4 */
    var footBottom = U.clamp(H * 0.04, 20, 40);
    stage.style.setProperty('--gap-t', px(gapT));
    stage.style.setProperty('--hg', px(hg));
    stage.style.setProperty('--foot-bottom', px(footBottom));
    var setMode = function (m) {
      stage.classList.toggle('is-flank', m === 'flank');
      stage.classList.toggle('is-band', m === 'band');
      stage.classList.toggle('is-stack', m === 'stack');
      stage.classList.remove('is-narrow', 'is-split', 'is-short-lead', 'is-cta-row');
      [foot, lead, actions, eyebrow].forEach(function (el) { if (el) { el.style.transform = ''; el.style.visibility = ''; } });
    };
    var fs, w0, h0, y0, x0, bg, gapB, m, mode, ctaRight = false;

    /* 1) lado a lado (desktop): uma metade de cada lado da mídia */
    if (landscape && W >= 1000) {
      setMode('flank'); stage.classList.remove('is-tight');
      gapB = U.clamp(H * 0.022, 14, 22);
      stage.style.setProperty('--gap-b', px(gapB));
      w0 = W * 0.45;
      x0 = (W - w0) / 2;
      stage.style.setProperty('--m-x', px(x0));
      stage.style.setProperty('--m-w', px(w0));
      stage.style.setProperty('--title-size', '100px');
      var wA = halfA.offsetWidth || 1, wB = halfB.offsetWidth || 1;
      var side = x0 - hg - gapT;
      var eyH = eyebrow.offsetHeight, footH = foot.offsetHeight;
      m = Math.min(gapT * 0.6, 26);
      h0 = Math.min(H * 0.65, H - hdr - 40);
      y0 = Math.max(hdr + 20, (H - h0) / 2);
      var center = y0 + h0 / 2;
      /* faixa do título (as duas metades na mesma linha de base): entre o eyebrow
         e o texto/ação; centrada na mídia, ou deslocada o mínimo para caber */
      var bandTop = y0 + eyH + 18, bandBot = H - footBottom - footH - gapB;
      fs = Math.min(92, side / wA * 100, side / wB * 100, (bandBot - bandTop) / 3.96);
      var bandC = U.clamp(center, bandTop + 1.98 * fs, bandBot - 1.98 * fs);
      stage.style.setProperty('--band-c', px(bandC));
      mode = fs >= minH1 ? 'flank' : 'band';
    } else {
      mode = landscape ? 'band' : 'stack';
    }

    /* 2) paisagem baixa ou estreita: painel central (45% da largura, centrado também
          na altura, que cresce simétrico). Em repouso, fora da mídia: o header no topo,
          o eyebrow e a 1ª metade do título acima do painel; abaixo, a 2ª metade (à
          direita) com "Agendar diagnóstico" na mesma linha (à esquerda) e a frase curta
          que diz o que a IRON AI faz e para quem. O painel fica com a maior altura que
          sobra depois disso (até 65%), com a mesma margem em cima e embaixo
          (bar.md, nota da rodada 17 no mecanismo 1). */
    if (mode === 'band') {
      setMode('band');
      stage.classList.add('is-short-lead');
      w0 = W * 0.45;
      x0 = (W - w0) / 2;
      fs = minH1;
      stage.style.setProperty('--title-size', px(fs));
      var hA = halfA.offsetHeight, hB = halfB.offsetHeight, ctaW = actions.offsetWidth, ctaH = actions.offsetHeight;
      var eyH = eyebrow.offsetHeight, eyGapB = 4;   /* eyebrow -> 1ª metade */
      /* a 2ª metade fecha o título sozinha na linha dela; abaixo, a frase e a ação na
         mesma linha (ação à direita) — a leitura termina antes de chegar à ação */
      var inRow = ctaW + 24 + 240 <= W - 2 * hm;
      stage.style.setProperty('--lead-w', px(inRow ? W - 2 * hm - ctaW - 24 : W - 2 * hm));
      var leadH = lead.offsetHeight, leadGap = 12, edge = 20;
      var row2 = inRow ? Math.max(leadH, ctaH) : leadH + 12 + ctaH;
      var rowH = hB;
      var gapMin = 16;                              /* título–painel: a tinta das letras não chega ao painel */
      var needT = hdr + 8 + eyH + eyGapB + hA + gapMin;
      var needB = gapMin + rowH + leadGap + row2 + edge;
      var y0min = Math.max(needT, needB);
      h0 = Math.max(H * 0.3, Math.min(H * 0.65, H - 2 * y0min));
      y0 = (H - h0) / 2;
      gapB = gapMin + Math.max(0, y0 - y0min) * 0.5;   /* folga que sobra: metade no vão título–painel */
      stage.style.setProperty('--gap-b', px(gapB));
      var aTop5 = y0 - gapB - hA, bTop5 = y0 + h0 + gapB;
      var rowBot = bTop5 + rowH;
      stage.style.setProperty('--a-top', px(aTop5));
      stage.style.setProperty('--ey-top', px(aTop5 - eyGapB - eyH));
      stage.style.setProperty('--b-top', px(bTop5));
      stage.style.setProperty('--cta-x', px(inRow ? W - hm - ctaW : hm));
      stage.style.setProperty('--cta-y', px(inRow ? rowBot + leadGap + (row2 - ctaH) / 2 : rowBot + leadGap + leadH + 12));
      stage.style.setProperty('--lead-y', px(inRow ? rowBot + leadGap + (row2 - leadH) / 2 : rowBot + leadGap));
      stage.classList.toggle('is-cta-row', inRow);
      ctaRight = inRow;
    }

    /* 3) retrato: 1ª metade acima, 2ª metade, texto e ação abaixo */
    if (mode === 'stack') {
      setMode('stack');
      var lowS = H < 760;                          /* celular baixo: texto curto, respiros menores */
      stage.classList.toggle('is-short-lead', lowS);
      gapB = lowS ? 16 : U.clamp(H * 0.028, 18, 26);
      stage.style.setProperty('--gap-b', px(gapB));
      var eyOff = lowS ? 10 : 14, eyGap = lowS ? 8 : 12, hfGap = lowS ? 10 : 14;
      if (lowS) { footBottom = 16; stage.style.setProperty('--foot-bottom', px(footBottom)); }
      stage.style.setProperty('--ey-top', px(hdr + eyOff));
      var wcol = W - 2 * hm;
      stage.classList.remove('is-tight');
      stage.style.setProperty('--title-size', px(minH1));
      /* a 2ª metade quebra em duas linhas se não couber em uma no page-max */
      stage.classList.toggle('is-tight', halfB.offsetWidth > wcol + 0.5);
      stage.style.setProperty('--title-size', '100px');
      var wA2 = halfA.offsetWidth || 1, wB2 = halfB.offsetWidth || 1;
      fs = Math.min(W <= 640 ? 52 : 64, wcol / wA2 * 100, wcol / wB2 * 100);
      /* telas baixas: o título cede altura para a mídia (até o piso de 48px) */
      var eyH2 = eyebrow.offsetHeight;
      var fixed = hdr + eyOff + eyH2 + eyGap + 2 * gapB + hfGap + foot.offsetHeight + footBottom;
      var titleLines100 = halfA.offsetHeight + halfB.offsetHeight;
      fs = Math.max(minH1, Math.min(fs, (H - fixed - H * 0.38) / titleLines100 * 100));
      stage.style.setProperty('--title-size', px(fs));
      var aTop = hdr + eyOff + eyH2 + eyGap;
      y0 = aTop + halfA.offsetHeight + gapB;
      var bottom = H - footBottom - foot.offsetHeight - hfGap - halfB.offsetHeight - gapB;
      h0 = Math.max(60, bottom - y0);
      w0 = W * (W <= 640 ? 0.7 : 0.6);
      x0 = (W - w0) / 2;
    }
    stage.style.setProperty('--title-size', px(fs));
    stage.style.setProperty('--m-x', px(x0));
    stage.style.setProperty('--m-y', px(y0));
    stage.style.setProperty('--m-w', px(w0));
    stage.style.setProperty('--m-h', px(h0));
    heroStart = { w: w0 / W, h: h0 / H, cy: (y0 + h0 / 2) / H, cx: (x0 + w0 / 2) / W };
    geo = { ctaRight: ctaRight, W: W, H: H, mode: mode, flank: mode === 'flank', band: mode === 'band', narrow: false, hdr: hdr, R0: { x: x0, y: y0, w: w0, h: h0 }, eyTop0: eyebrow.offsetTop, aTop0: halfA.offsetTop };
    /* bordas laterais do conteúdo do hero em repouso (left/right computados não
       dependem do transform): o header usa essas bordas enquanto está sobre o hero */
    var hl = parseFloat(getComputedStyle(halfA).left), hr = parseFloat(getComputedStyle(halfB).right);
    if (siteHeader && isFinite(hl) && isFinite(hr)) {
      siteHeader.style.setProperty('--hx-l', Math.max(hl, 16) + 'px');
      siteHeader.style.setProperty('--hx-r', Math.max(hr, 16) + 'px');
    }
    return heroStart;
  }
  var siteHeader = document.querySelector('.site-header');
  measureHero();
  if (siteHeader) siteHeader.classList.add('is-wide');   /* hero em repouso: alinhado ao conteúdo dele */

  var vis = (canvas && window.IronVisuals) ? window.IronVisuals.createAILayer(canvas, {
    startRect: function () { return heroStart; },
    still: mode === 'static'    /* movimento reduzido: sem expansão, só a tela cheia */
  }) : null;

  /* ---------------------------------------------------------------------
     Movimento reduzido: hero estático, manifesto aceso. A mídia fica no lugar
     do estado inicial (desktop) ou na largura toda da tela entre as metades do
     título (telas estreitas), num tamanho em que os nomes das áreas aparecem.
     O header fica fixo no topo, com a ação sempre visível.
     --------------------------------------------------------------------- */
  if (mode === 'static') {
    /* Movimento reduzido: hero em fluxo (CSS). Texto sobre paper; a mídia vem em
       seguida como bloco próprio do tamanho da tela, mostrando a rede completa
       (as 11 áreas e o DRE, com nomes). O header é opaco e fica sempre na tela. */
    S.home = {
      mode: mode,
      progress: function () { return 1; },
      panelRect: function () { return vis ? vis.rectAt(1) : null; },
      rectAt: function (p) { return vis ? vis.rectAt(p) : null; },
      debugLayout: function (p) { return vis ? vis.debugLayout(p === undefined ? 1 : p) : null; }
    };
    if (vis) {
      var drawStatic = function () { vis.resize(); vis.render(3.4, 1); };
      drawStatic();
      S.fontsReady.then(drawStatic);
      window.addEventListener('resize', U.debounce(drawStatic, 150));
    }
    /* header fixo no topo, com a ação sempre na tela */
    var staticCta = foot.querySelector('.button');
    var hdrCtaS = document.querySelector('.site-header__cta'), ctaShown = null;
    var solidStatic = function () {
      var r = (staticCta || foot).getBoundingClientRect(), hh = S.header.height();
      S.header.setSolid(r.top < hh);
      var show = r.bottom <= hh;                   /* a ação do hero já passou sob o header */
      if (hdrCtaS && show !== ctaShown) {
        ctaShown = show;
        if (siteHeader) siteHeader.classList.toggle('is-wide', !show);
        hdrCtaS.style.visibility = show ? '' : 'hidden';
        if (show) hdrCtaS.removeAttribute('tabindex'); else hdrCtaS.setAttribute('tabindex', '-1');
        hdrCtaS.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
    };
    S.onScroll(solidStatic);
    solidStatic();
    return;
  }

  /* ---------------------------------------------------------------------
     Hero: progresso p (0..1) -> mídia cresce nas duas dimensões (visuals.js);
     cada elemento do hero é empurrado para fora pela borda da mídia do seu lado
     (mesmo deslocamento da borda: a distância até a mídia nunca diminui).
     --------------------------------------------------------------------- */
  var hero = { target: 0, p: 0, applied: -1, range: 700, visible: true, interacted: false, hdrHide: 0 };
  var hdrState = { y: null, solid: null, rule: null, cta: null }; /* último estado gravado no header */
  /* "Agendar diagnóstico" uma vez por vista (design-system.md, regra 2): sobre o hero
     em repouso a ação é o botão primário do hero, e o do header fica escondido; ele
     volta quando o header passa a viajar na folha do manifesto (a troca acontece com
     o header fora da tela, então nada aparece de uma vez) */
  var hdrCta = document.querySelector('.site-header__cta');
  function setHeaderCta(show) {
    if (!hdrCta || hdrState.cta === show) return;
    hdrState.cta = show;
    if (siteHeader) siteHeader.classList.toggle('is-wide', !show);
    hdrCta.style.visibility = show ? '' : 'hidden';
    if (show) hdrCta.removeAttribute('tabindex'); else hdrCta.setAttribute('tabindex', '-1');
    hdrCta.setAttribute('aria-hidden', show ? 'false' : 'true');
  }


  /* desloca um elemento do hero; opacidade sempre 1. Fora da tela, sai da árvore
     de acessibilidade (visibility: hidden) — nada some por opacidade. */
  function setT(el, x, y) {
    /* em px inteiro: bordas de botão e de caixa sem meia cobertura (sem tons fora dos tokens) */
    el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
    el.style.opacity = '';
    var r = el.getBoundingClientRect();
    var out = r.right <= 0 || r.left >= geo.W || r.bottom <= 0 || r.top >= geo.H;
    el.style.visibility = out ? 'hidden' : '';
  }

  /* Distância horizontal de cada elemento até sair inteiro da tela (sem contar o
     deslocamento atual), ritmo das metades e janela de saída do header. */
  var PX = 0.82;                                     /* as metades terminam de sair perto do fim */
  var PX_BAND = PX;                                  /* paisagem baixa: o mesmo ritmo */
  function ensureExit() { if (geo && geo.dA === undefined) exitDistances(); }
  function exitDistances() {
    var tx = function (el) { return parseFloat((el.style.transform || '').replace(/^translate3d\(([-0-9.]+)px.*/, '$1')) || 0; };
    var ty = function (el) { return parseFloat((el.style.transform || '').replace(/^translate3d\([-0-9.]+px,\s*([-0-9.]+)px.*/, '$1')) || 0; };
    var outL = function (el) { return el.getBoundingClientRect().right - tx(el) + 4; };
    var outR = function (el) { return geo.W - (el.getBoundingClientRect().left - tx(el)) + 4; };
    geo.dA = outL(halfA);
    geo.dB = outR(halfB);
    geo.dE = outL(eyebrow);
    geo.dC = actions ? outR(actions) : 0;
    geo.dCL = actions ? outL(actions) : 0;
    geo.dLd = lead ? outL(lead) : 0;
    if (geo.flank) {
      /* lado a lado: cada metade é empurrada pela borda da mídia e se afasta um pouco
         mais (c·p²), na medida para as duas terminarem de sair em p = PX */
      var Rx = vis ? vis.rectAt(PX) : geo.R0;
      var dLx = geo.R0.x - Rx.x, dRx = (Rx.x + Rx.w) - (geo.R0.x + geo.R0.w);
      geo.cA = Math.max(0, Math.max(outL(halfA), outL(eyebrow)) - dLx) / (PX * PX);
      geo.cB = Math.max(0, Math.max(outR(halfB), outR(foot)) - dRx) / (PX * PX);
    } else {
      /* topo do texto mais alto (com a altura toda da fonte), que empurra o header */
      var topEl = eyebrow;                         /* eyebrow, acima da 1ª metade */
      var rg = document.createRange(); rg.selectNodeContents(topEl);
      geo.textTop0 = Math.min(topEl.getBoundingClientRect().top, rg.getBoundingClientRect().top) - ty(topEl) - stage.getBoundingClientRect().top;
    }
    /* header: sai inteiro dentro de um evento da roda (entre duas paradas k/7), o
       evento em que a borda (ou o texto) chegaria a ele — nunca fica uma tira fina */
    geo.hp1 = 0; geo.hp0 = 0;
    for (var k = 0; k <= 7; k++) { if (limitAt(k / 7) < geo.hdr - 0.5) { geo.hp1 = k / 7; break; } geo.hp1 = 1; }
    geo.hp0 = Math.max(0, geo.hp1 - 1 / 7);
  }
  /* até onde a base do header pode ir no progresso p */
  function limitAt(p) {
    var R = vis ? vis.rectAt(p) : geo.R0;
    return geo.flank ? R.y : geo.textTop0 - 4 - (geo.R0.y - R.y);
  }
  /* altura visível do header no progresso p (0 = fora da tela) */
  function headerVisibleAt(p) {
    if (!geo) return 0;
    ensureExit();
    var s = geo.hp1 > geo.hp0 ? U.smoothstep(geo.hp0, geo.hp1, p) : (p >= geo.hp1 ? 1 : 0);
    return Math.max(0, Math.min(geo.hdr, limitAt(p), geo.hdr * (1 - s)));
  }

  /* Saída coerente: título, eyebrow, texto de apoio, botão e header saem todos do
     mesmo jeito — empurrados pela borda da mídia, opacos, cortados pela borda da
     tela (o header sobe empurrado pelo texto de cima). */
  function apply(p) {
    if (Math.abs(p - hero.applied) < 0.00005 || !geo) return;
    hero.applied = p;
    var R0 = geo.R0, R = vis ? vis.rectAt(p) : R0;
    var dL = R0.x - R.x, dR = (R.x + R.w) - (R0.x + R0.w);
    var dT = R0.y - R.y, dB = (R.y + R.h) - (R0.y + R0.h);
    ensureExit();
    if (geo.flank) {
      var exA = geo.cA * p * p, exB = geo.cB * p * p;
      setT(eyebrow, -(dL + exA), 0);
      setT(halfA, -(dL + exA), 0);
      setT(halfB, dR + exB, 0);
      if (geo.narrow) setT(foot, 0, dB); else setT(foot, dR + exB, 0);
    } else {
      /* banda e retrato: a 1ª metade fica acima da mídia e a 2ª abaixo. Cada uma
         viaja com a borda da mídia do seu lado (a de cima sobe com a borda de cima,
         a de baixo desce com a de baixo — a folga até a mídia e o fundo não muda) e,
         ao mesmo tempo, desliza para fora em direções opostas (a de cima para a
         esquerda, a de baixo para a direita), no mesmo ritmo, até sair inteira em
         p = PX (paisagem baixa: PX_BAND). */
      var u = U.clamp(p / (geo.band ? PX_BAND : PX), 0, 1), g = Math.pow(u, 1.5);
      setT(halfA, -geo.dA * g, -dT);
      setT(halfB, geo.dB * g, dB);
      if (geo.band) {
        /* eyebrow: sobe com a 1ª metade e sai pela esquerda com ela; a frase, abaixo
           da linha da 2ª metade, desce com a borda e sai pela esquerda no mesmo ritmo;
           a ação, na linha da 2ª metade (à esquerda), desce empurrada pela borda de
           baixo e, quando a borda a alcança, sai pela esquerda até o fim da saída das
           metades — fica inteira na tela o máximo possível e não sobra uma tira dela */
        foot.style.transform = '';
        setT(eyebrow, -geo.dE * g, -dT);
        setT(lead, -geo.dLd * g, dB);
        var uc = U.clamp((p - 0.28) / (PX_BAND - 0.28), 0, 1);
        setT(actions, (geo.ctaRight ? geo.dC : -geo.dCL) * Math.pow(uc, 1.5), dB);  /* sai pelo lado em que está */
      } else {
        setT(eyebrow, -geo.dE * g, -dT);          /* eyebrow acima da 1ª metade, junto com ela */
        setT(foot, 0, dB);                        /* texto e ação: empurrados pela borda de baixo */
      }
    }
    /* header: sai empurrado pela borda da mídia (lado a lado) ou pelo texto de cima
       (empilhado), inteiro dentro de um evento da roda; a base dele nunca passa de
       nenhum dos dois */
    var v = headerVisibleAt(p);
    hero.hdrHide = U.clamp((geo.hdr - v) / geo.hdr, 0, 1);
    if (p > 0.02) S.header.closeMenu();
  }

  var spacerH = spacer ? spacer.offsetHeight : 0;
  /* topo do manifesto no documento: a borda da folha que sobe sobre o hero */
  var manTop = Infinity;
  var manGap = 32; /* base do header -> eyebrow, na folha (space-4 / space-3) */
  function measureManifesto() {
    manTop = manifesto ? manifesto.getBoundingClientRect().top + window.scrollY : Infinity;
    if (manifesto) manGap = Math.max(1, (parseFloat(getComputedStyle(manifesto).paddingTop) || 0) - (S.header.height() || 84));
  }
  measureManifesto();

  /* --- modo travado: a roda alimenta o progresso enquanto a página está no topo --- */
  function atTop() {
    var L = S.lenis;
    return L.animatedScroll <= 0.5 && L.targetScroll <= 0.5 && window.scrollY <= 1;
  }
  function consume(e) { if (e && e.cancelable) e.preventDefault(); }
  /* soma de passos (ex.: 7 × 100/700) pode parar em 0,9999999: fecha nas pontas */
  function setTarget(v) { hero.target = v > 0.9999 ? 1 : v < 0.0001 ? 0 : v; }

  if (mode === 'locked') {
    S.addWheelGuard(function (data) {
      var e = data.event, dy = data.deltaY;
      if (!dy || (e && e.ctrlKey) || !atTop()) return true;
      if (dy > 0) {
        if (hero.target < 1) {
          hero.interacted = true;
          setTarget(Math.min(1, hero.target + dy / hero.range));
          consume(e); return false;
        }
        /* alvo completo, mas o painel ainda está terminando de crescer: segura a página */
        if (hero.p < 0.985) { consume(e); return false; }
        return true;
      }
      if (hero.target > 0) {
        hero.interacted = true;
        setTarget(Math.max(0, hero.target + dy / hero.range));
        consume(e); return false;
      }
      return true;
    });

    /* teclado: mesmas regras da roda */
    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (!atTop()) return;
      var k = e.key;
      var down = k === 'ArrowDown' || k === 'PageDown' || k === 'End' || (k === ' ' && !e.shiftKey);
      var up = k === 'ArrowUp' || k === 'PageUp' || k === 'Home' || (k === ' ' && e.shiftKey);
      var step = (k === 'PageDown' || k === 'PageUp' || k === ' ') ? 0.5 : 0.2;
      if (down && (hero.target < 1 || hero.p < 0.985)) {
        e.preventDefault(); hero.interacted = true;
        setTarget(k === 'End' ? 1 : Math.min(1, hero.target + step));
      } else if (up && hero.target > 0) {
        e.preventDefault(); hero.interacted = true;
        setTarget(k === 'Home' ? 0 : Math.max(0, hero.target - step));
      }
    });

    /* carregou já rolado (restauração, âncora): começa expandido */
    if (window.scrollY > 2) { hero.target = hero.p = 1; }
  }

  apply(hero.p);
  updateHeader();

  /* --- laço único (ticker do GSAP, que também move o Lenis) --- */
  gsap.ticker.add(function (time, deltaMs) {
    var dt = Math.min(deltaMs || 16.7, 64) / 1000;
    if (mode === 'locked') {
      /* invariante: página rolada => hero expandido (barra de rolagem, foco, âncora) */
      if (window.scrollY > 2 && hero.target < 1) {
        hero.target = 1;
        if (!hero.interacted) hero.p = 1;
      }
      var d = hero.target - hero.p;
      hero.p = Math.abs(d) > 0.0004 ? U.damp(hero.p, hero.target, 7.5, dt) : hero.target;
    } else {
      hero.p = hero.target = U.clamp(window.scrollY / Math.max(1, spacerH), 0, 1);
    }
    apply(hero.p);
    updateHeader();
    if (vis && hero.visible) vis.render(time, hero.p);
  });

  /* ---------------------------------------------------------------------
     Header (barra opaca, 84 px, com nav e "Agendar diagnóstico" sempre), em
     função da posição, sem nada disparado por tempo:
     - estado inicial e expansão: no topo; a borda superior da mídia (desktop)
       ou a 1ª linha do título (retrato) o empurra para cima; com a mídia em
       100% ele está fora da tela, acima.
     - passagem: o header viaja na borda superior da folha do manifesto. A folha
       sobe por cima da mídia e a primeira coisa nela é a barra do header: ela
       entra pela base da tela e fica inteira depois de 84 px de rolagem.
     - quando a borda da folha chega ao topo da tela, o header encaixa e fica
       fixo até o fim da página. Subindo, o mesmo caminho ao contrário.
     A troca de posição (topo -> base da tela) acontece com o header fora da
     tela nas duas pontas: nada aparece de uma vez.
     --------------------------------------------------------------------- */
  function updateHeader() {
    var hdr = S.header.height() || 84;
    var H = window.innerHeight;
    var sheetTop = manTop - window.scrollY;     /* borda da folha na tela */
    var y;
    if (sheetTop < H - 0.5) y = Math.max(0, sheetTop);           /* na borda da folha / encaixado */
    else y = -hero.hdrHide * (hdr + 1);                           /* empurrado pela mídia */
    y = Math.round(y);                          /* px inteiro: borda do header sem meia cobertura */
    if (y !== hdrState.y) { hdrState.y = y; S.header.setY(y); }
    /* divisória: inteira sobre o hero; nenhuma enquanto o header é a faixa de cima
       da folha; encaixado, abre conforme o conteúdo chega à base dele */
    var rule = sheetTop >= H - 0.5 ? 1 : U.clamp(-sheetTop / manGap, 0, 1);
    rule = Math.round(rule * 1000) / 1000;
    if (rule !== hdrState.rule) { hdrState.rule = rule; S.header.setRule(rule); }
    var solid = sheetTop < H - 0.5;
    if (solid !== hdrState.solid) { hdrState.solid = solid; S.header.setSolid(solid); }
    setHeaderCta(sheetTop < H - 0.5);
  }

  /* ---------------------------------------------------------------------
     Passagem hero -> manifesto (barra 6): a mídia fica em tela cheia (hero sticky)
     e a folha do manifesto, com a barra do header na borda, sobe por cima dela e a
     cobre. A mídia sobe devagar no mesmo sentido da rolagem (4% da altura ao longo
     da passagem, power1.out; o mesmo recuo vertical aprovado na r7), sem escala:
     ela ocupa sempre a largura toda e a sua base fica sempre sob a folha.
     Ligado à rolagem (scrub), reversível. Coberta, o canvas para.
     --------------------------------------------------------------------- */
  /* o deslocamento é aplicado em px inteiros (power1.out escrito à mão): com um
     translate fracionário o canvas era reamostrado e as hairlines de 1 px do campo
     viravam faixas de 2 px em cores fora dos tokens */
  if (manifesto) {
    var passTy = null;
    var setPass = function (prog) {
      var e = 1 - Math.pow(1 - U.clamp(prog, 0, 1), 2);
      var ty = Math.round(-0.04 * stage.offsetHeight * e);
      if (ty === passTy) return;
      passTy = ty;
      stage.style.transform = ty ? 'translate3d(0,' + ty + 'px,0)' : '';
    };
    ST.create({
      trigger: manifesto, start: 'top bottom', end: 'top top',
      onUpdate: function (self) { setPass(self.progress); },
      onRefresh: function (self) { passTy = null; setPass(self.progress); },
      onLeave: function () { hero.visible = false; },
      onEnterBack: function () { hero.visible = true; }
    });
  }

  /* ---------------------------------------------------------------------
     Manifesto (h2): cada palavra passa de subtle para accent (frente, 2 palavras)
     e depois para text, conforme a linha sob o centro da tela.
     --------------------------------------------------------------------- */
  var reveal = null;
  if (revealEl) reveal = initReveal(revealEl);

  /* divide o texto em spans .w; uma palavra que atravessa elementos (ex.: "ali"
     dentro do <i> e o ponto fora dele) vira um grupo de spans com o mesmo estado */
  function splitWords(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var groups = [], glue = false;
    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(/([ \t\n\r]+)/);
      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); glue = false; return; }
        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = part;
        frag.appendChild(span);
        if (glue && groups.length) groups[groups.length - 1].push(span); else groups.push([span]);
        glue = true;
      });
      node.parentNode.replaceChild(frag, node);
    });
    return groups;
  }

  /* Estados por palavra (classes; cores em site.css, todas de token):
     'off' (subtle), 'front' (accent) e aceso (sem classe: text, ou accent no <i>).
     A frente é sempre as FRONT palavras imediatamente antes do ponto de leitura. */
  function initReveal(el) {
    var FRONT = 2; /* largura da frente, em palavras (1 a 3) */
    var items = splitWords(el).map(function (g) { return { els: g, st: '' }; });
    var top = 0, lh = 1, lines = [];

    /* agrupa as palavras por linha renderizada: lines[k] = { first, count } */
    function measure() {
      sizeD();
      var r = el.getBoundingClientRect();
      top = r.top + window.scrollY;
      lh = parseFloat(getComputedStyle(el).lineHeight) || 1;
      lines = [];
      for (var i = 0; i < items.length; i++) {
        var wr = items[i].els[0].getBoundingClientRect();
        var k = Math.max(0, Math.round((wr.top + wr.height / 2 - r.top - lh / 2) / lh));
        while (lines.length <= k) lines.push({ first: i, count: 0 });
        if (lines[k].count === 0) lines[k].first = i;
        lines[k].count++;
      }
    }
    /* A leitura acontece com a folha já encaixada (quadro parado, depois da passagem
       hero -> manifesto): de manTop (folha no topo) até manTop + D, a frente avança
       linha a linha e, dentro de cada linha, palavra a palavra, presa à rolagem. A
       frase fica perto do meio da tela. A camada dos pilares só chega depois de uma
       pausa (margem superior dela, site.css: o mesmo D mais 30% da tela), para a frase
       ficar inteira e acesa com o quadro parado antes de ser coberta. Antes de
       encaixar, tudo apagado; subir apaga de volta. Na última linha a frente anda as
       palavras e a própria largura. */
    var D = 300;
    function sizeD() {
      var H = window.innerHeight, mr = manifesto ? manifesto.getBoundingClientRect() : null;
      var extra = mr ? Math.max(0, mr.height - H) : 0;            /* rolagem da folha até travar pela base */
      D = U.clamp(Math.round(H * 0.42), 220, 380) + extra;        /* = clamp(220px, 42vh, 380px) do CSS */
    }
    function frontIndex(y) {
      if (!lines.length) return 0;
      var s = (y - manTop) / D * (lines.length + 0.25);
      if (s < 0) return 0;
      var k = Math.floor(s);
      if (k >= lines.length) return items.length + FRONT;
      var ln = lines[k];
      var span = ln.count + (k === lines.length - 1 ? FRONT : 0);
      return ln.first + (s - k) * span;
    }
    function update(y) {
      var n = Math.ceil(frontIndex(y) - 1e-6); /* palavras 0..n-1 já alcançadas */
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var st = i >= n ? 'off' : (i >= n - FRONT ? 'front' : '');
        if (st !== it.st) {
          for (var j = 0; j < it.els.length; j++) {
            if (it.st) it.els[j].classList.remove('is-' + it.st);
            if (st) it.els[j].classList.add('is-' + st);
          }
          it.st = st;
        }
      }
    }
    /* scrollY em que o texto fica todo aceso */
    function endY() {
      if (!lines.length) return 0;
      return manTop + D;
    }
    measure();
    update(window.scrollY);
    return { measure: measure, update: update, endY: endY };
  }

  S.onScroll(function (y) { if (reveal) reveal.update(y); });

  /* ---------------------------------------------------------------------
     Medidas: fontes, refresh do ScrollTrigger, redimensionamento
     --------------------------------------------------------------------- */
  function remeasure() {
    spacerH = spacer ? spacer.offsetHeight : 0;
    measureManifesto();
    if (reveal) { reveal.measure(); sizeNext(); reveal.update(window.scrollY); }
  }
  /* #proximas-partes ainda não tem conteúdo: fica com altura 0, ou só a rolagem que
     falta para a frente do manifesto sair da última linha antes do fim da página */
  var nextParts = document.getElementById('proximas-partes');
  function sizeNext() {
    if (!nextParts || !reveal) return;
    nextParts.style.height = '0px';
    var maxY = document.documentElement.scrollHeight - window.innerHeight;
    var need = Math.ceil(reveal.endY() - maxY) + 2;
    nextParts.style.height = Math.max(0, need) + 'px';
  }
  ST.addEventListener('refresh', remeasure);
  S.fontsReady.then(function () { measureHero(); if (vis) vis.resize(); hero.applied = -1; apply(hero.p); remeasure(); });

  /* leitura de estado (verificação automatizada; não altera nada) */
  S.home = {
    mode: mode,
    progress: function () { return hero.p; },
    panelRect: function () { return vis ? vis.rectAt(hero.p) : null; },
    rectAt: function (p) { return vis ? vis.rectAt(p) : null; },
    debugLayout: function (p) { return vis ? vis.debugLayout(p) : null; },
    sheetEdge: function () { return manTop - window.scrollY; },
    bgRect: function () { return null; },          /* sem camada que esmaece: a cena é coberta */
    zoomAt: function (p) { return vis ? vis.zoomAt(p) : 1; },
    setProgress: function (p) { hero.target = hero.p = p; hero.interacted = true; },
    headerState: function () { return { y: hdrState.y, sheetTop: manTop - window.scrollY, dockAt: manTop }; }
  };

  window.addEventListener('resize', U.debounce(function () {
    measureHero();
    if (vis) vis.resize();
    hero.applied = -1;
    apply(hero.p);
    remeasure();
  }, 120));
})();
