/* =========================================================================
   IRON AI — p2.js (home, parte 2)
   - Camadas que cobrem a anterior (barra: mecanismo 6): cada seção fica presa
     pela base (sticky com top negativo) enquanto a seguinte sobe por cima.
   - Esteira em cartões empilhados (mecanismo 3): cartões ProductCard presos no topo;
     o coberto encolhe (0,96 -> 0,90, pela largura, em px inteiros) e sobe 24 px por
     cartão acima dele; a faixa visível de cada um mostra o visual em accent. O
     visual interno entra em 2x e chega a 1x quando o cartão assenta (viewBox).
   - Transição por zoom (mecanismo 4): área fixa de 100vh durante 300vh; um painel
     central e 6 ao redor crescem de 1x até 4,6–9x, cada um no seu ritmo; o central
     cobre a tela inteira a partir de q ≈ 0,7 e vira o fundo dos casos de uso
     (paper + a mesma grade de hairlines, no mesmo passo e fase) (mecanismos 6 e 7).
   Tudo é função direta da posição da rolagem (mecanismo 5): igual descendo e
   subindo, sem nada disparado por tempo. Movimento reduzido: estático e completo.
   Desenho do zoom em pixel inteiro e só com tokens (nada esmaece por opacidade).
   ========================================================================= */
(function () {
  'use strict';
  var S = window.IronSite;
  if (!S) return;
  var U = S.util, ST = S.ScrollTrigger;
  var root = document.documentElement;
  var reduced = S.reducedMotion;

  var intro = document.querySelector('[data-intro]');
  var layers = [].slice.call(document.querySelectorAll('[data-layer]'));
  var pinned = (intro ? [intro] : []).concat(layers);
  var list = document.querySelector('[data-stack-list]');
  var esteira = list ? list.closest('.esteira') : null;
  var cards = list ? [].slice.call(list.querySelectorAll('[data-card]')) : [];
  var svgs = cards.map(function (c) { return c.querySelector('.stack__svg'); });
  var zoom = document.querySelector('[data-zoom]');
  var stage = document.querySelector('[data-zoom-stage]');
  var canvas = document.querySelector('[data-zoom-canvas]');
  var casos = document.querySelector('[data-casos]');
  var ctx = canvas ? canvas.getContext('2d') : null;

  /* cores (tokens) */
  var C = {};
  ['paper', 'soft', 'surface', 'band', 'acid', 'icon-bg', 'accent', 'accent-text', 'line', 'text'].forEach(function (n) {
    C[n] = U.css(U.rgb(U.token('--' + n) || '#000000'));
  });

  var STEP = 24, SHRINK = 0.04, MIN_SCALE = 0.90, G = 48;
  var M = { W: 0, H: 0, hdr: 84, T: 140, cardH: 560, listTop: 0, zoomTop: 0, zoomLen: 1, dpr: 1, sw: 0, sh: 0, ha: 0, oy: 0, ox: 0 };

  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  /* ---------------------------------------------------------------------
     Medidas (sem as travas, para valerem as posições do fluxo)
     --------------------------------------------------------------------- */
  function measure() {
    root.classList.remove('pins-on');
    M.W = window.innerWidth; M.H = window.innerHeight;
    M.hdr = S.header.height() || 84;
    if (list) {
      /* 2 bordas de 24 px cabem entre a base do header e o cartão da frente */
      M.T = M.hdr + 2 * STEP + 8;
      /* padding inferior da seção: space-8, ou space-7 no mobile e em tela baixa */
      M.padB = (M.W <= 640 || (M.H <= 640 && !reduced)) ? 78 : 120;
      if (esteira) esteira.style.setProperty('--esteira-pb', M.padB + 'px');
      layoutCards();
      list.style.setProperty('--stack-top', M.T + 'px');
      list.style.setProperty('--card-h', M.cardH + 'px');
      /* depois do último cartão, uma pausa com os 5 empilhados; a esteira fica presa
         pela base e o zoom sobe por cima deles */
      list.style.setProperty('--stack-hold', Math.round(M.H * 0.25) + 'px');
      M.listTop = docTop(list);
    }
    /* trava pela base: a seção fica parada quando a sua base chega à base da tela
       (ou logo abaixo do header, se for mais baixa que a tela) */
    pinned.forEach(function (el) {
      el.style.setProperty('--pin-top', Math.round(Math.min(M.hdr, M.H - el.offsetHeight)) + 'px');
    });
    if (zoom && canvas) {
      M.zoomTop = docTop(zoom);
      M.zoomLen = Math.max(1, zoom.offsetHeight - (stage ? stage.offsetHeight : M.H));
      M.dpr = Math.min(window.devicePixelRatio || 1, 2);
      M.sw = stage.clientWidth; M.sh = stage.clientHeight;
      /* o zoom se centra na área visível sob o header (que fica sempre na tela) */
      M.ha = M.sh - M.hdr; M.oy = Math.round(M.hdr + M.ha / 2); M.ox = Math.round(M.sw / 2);
      /* o central chega a q = 1 cobrindo também a faixa atrás do header */
      CENTRO.S = Math.max(4 / (1 - 2 * BAND), M.oy / (CENTRO.h / 2 * M.ha) + 0.01);
      canvas.width = Math.round(M.sw * M.dpr); canvas.height = Math.round(M.sh * M.dpr);
    }
    if (casos) {
      /* a grade do fundo dos casos continua a do painel central no fim do zoom:
         linhas em W/2 + k·G e, quando a seção entra pela base, em oy + k·G */
      var gx = (M.ox || Math.round(M.W / 2)) % G, gy = ((((M.oy || M.H / 2) - (M.sh || M.H)) % G) + G) % G;
      casos.style.setProperty('--grid', G + 'px');
      casos.style.setProperty('--grid-x', gx + 'px');
      casos.style.setProperty('--grid-y', gy + 'px');
    }
    if (!reduced) root.classList.add('pins-on');
  }

  /* ---------------------------------------------------------------------
     Esteira
     --------------------------------------------------------------------- */
  /* Arranjo do cartão: "side" (visual à esquerda, 58% da largura, texto à direita),
     "band2" (visual em faixa no topo, texto em duas colunas) ou "band1" (faixa e uma
     coluna). Fica o primeiro em que o texto inteiro cabe e o visual ainda domina.
     Altura do cartão: a que deixa space-8/space-7 sob ele com a pilha no topo; se o
     texto pedir mais, até o limite em que, no fim da pausa, o cartão da frente sobe
     no máximo até a base do header (T - header = 56 px). */
  function bodyNeed(c, mode) {
    var body = c.querySelector('.stack__body');
    if (mode !== 'side') return body.offsetHeight;
    var cs = getComputedStyle(body), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    return pad + 3 * 24 + ['.icon-box', '.stack__intro', '.stack__list', '.stack__foot'].reduce(function (sum, q) { return sum + c.querySelector(q).offsetHeight; }, 0);
  }
  function layoutCards() {
    cards.forEach(function (c) { c.style.width = ''; c.style.transform = ''; });
    list.style.setProperty('--card-h', 'auto');          /* altura natural, para medir */
    var prefer = M.H - M.T - M.padB, maxH = M.H - M.hdr - M.padB;
    var tries = [];
    if (reduced) {                                          /* estático: altura natural, conteúdo inteiro */
      list.setAttribute('data-mode', M.W > 900 ? 'side' : (M.W >= 560 ? 'band2' : 'band1'));
      list.removeAttribute('data-tight');
      M.mode = list.getAttribute('data-mode'); M.cardH = 0; M.Wc = Math.round(list.getBoundingClientRect().width);
      return;
    }
    if (M.W > 900) tries.push(['side', 62, false], ['side', 58, false], ['side', 52, false]);
    if (M.W >= 560) tries.push(['band2', 0, false]);
    tries.push(['band1', 0, false]);
    if (M.W >= 560) tries.push(['band2', 0, true]);
    tries.push(['band1', 0, true]);
    var pick = null, best = null;
    function tryMode(mode, fr, tight) {
      list.setAttribute('data-mode', mode);
      if (tight) list.setAttribute('data-tight', ''); else list.removeAttribute('data-tight');
      list.style.setProperty('--vis-a', (fr || 58) + 'fr'); list.style.setProperty('--vis-b', (100 - (fr || 58)) + 'fr');
      var need = 0;
      cards.forEach(function (c) { need = Math.max(need, Math.ceil(bodyNeed(c, mode)) + 2); });
      var h, band, ok;
      if (mode === 'side') {
        h = Math.min(Math.max(prefer, need), 700); band = h; ok = need <= Math.min(maxH, 700);
        h = Math.min(Math.max(h, need), maxH);
      } else {
        var minBand = Math.max(100, Math.round(0.26 * prefer));
        h = Math.min(Math.max(prefer, need + minBand), maxH); band = h - need; ok = band >= minBand;
      }
      return { mode: mode, fr: fr, tight: tight, h: Math.round(Math.max(300, h)), need: need, band: band, ok: ok };
    }
    for (var i = 0; i < tries.length && !pick; i++) {
      var r = tryMode(tries[i][0], tries[i][1], tries[i][2]);
      if (r.ok) pick = r; else if (!best || r.band > best.band) best = r;
    }
    if (!pick) pick = best;
    list.style.setProperty('--vis-a', (pick.fr || 58) + 'fr'); list.style.setProperty('--vis-b', (100 - (pick.fr || 58)) + 'fr');
    list.setAttribute('data-mode', pick.mode);
    if (pick.tight) list.setAttribute('data-tight', ''); else list.removeAttribute('data-tight');
    M.mode = pick.mode + (pick.tight ? '+tight' : ''); M.textNeed = pick.need;
    M.cardH = pick.h;
    /* faixa do visual em px inteiros, cartão a cartão (o texto fica com o resto) */
    cards.forEach(function (c) {
      if (pick.mode === 'side') { c.style.removeProperty('--band-h'); return; }
      var bh = Math.ceil(c.querySelector('.stack__body').getBoundingClientRect().height);
      c.style.setProperty('--band-h', Math.max(0, M.cardH - 2 - bh) + 'px');
    });
    M.Wc = Math.round(list.getBoundingClientRect().width);
  }

  var stackState = [];
  function zoomBox(sv, v) {                                 /* visual em v x: viewBox centrado */
    var w = 400 / v, h = 300 / v;
    sv.setAttribute('viewBox', (200 - w / 2).toFixed(2) + ' ' + (150 - h / 2).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2));
  }
  function updateStack(y) {
    if (!cards.length) return;
    var n = cards.length, cover = [], arrive = [];
    for (var j = 0; j < n; j++) {
      var st = M.listTop + j * M.cardH - y;               /* topo do cartão j sem a trava */
      arrive[j] = U.clamp((M.H - st) / Math.max(1, M.H - M.T), 0, 1);
      cover[j] = U.clamp((M.T + M.cardH - st) / M.cardH, 0, 1);
    }
    for (var i = 0; i < n; i++) {
      var depth = 0;
      for (var k = i + 1; k < n; k++) depth += cover[k];
      var ty = Math.round(-STEP * Math.min(depth, 2));
      var sc = Math.max(MIN_SCALE, 1 - SHRINK * depth);
      /* encolhe pela largura, em px inteiros e centrado (sem transform de escala: as
         bordas e o visual ficam em pixel inteiro, sem cor intermediária) */
      var cut = Math.round(M.Wc * (1 - sc) / 2), w = M.Wc - 2 * cut;
      var v = 2 - arrive[i];                                /* visual: 2x ao entrar, 1x ao assentar */
      var key = ty + '|' + w + '|' + v.toFixed(4);
      if (stackState[i] === key) continue;
      stackState[i] = key;
      cards[i].style.transform = ty ? 'translateY(' + ty + 'px)' : '';
      cards[i].style.width = cut ? w + 'px' : '';
      if (svgs[i]) zoomBox(svgs[i], v);
    }
  }

  /* ---------------------------------------------------------------------
     Zoom: 7 painéis (centro: cx, cy em fração da tela; tamanho w, h; escala final S)
     --------------------------------------------------------------------- */
  var BAND = 0.12;                                          /* faixa da borda do painel central */
  /* posições da Ref. C, em fração da área visível sob o header (largura W, altura
     H - header), centradas nela; escalas finais de 4,6 a 9 (ritmos próprios): os
     vizinhos do centro (acima, à direita) crescem pouco menos que ele e ficam a uma
     fresta dele até sair da tela, logo antes de ele cobrir a tela */
  var PANELS = [
    { kind: 'hotel', cx: 0.05, cy: -0.30, w: 0.35, h: 0.30, S: 4.6 },
    { kind: 'areas', cx: -0.25, cy: -0.10, w: 0.20, h: 0.45, S: 5.5 },
    { kind: 'restaurante', cx: 0.275, cy: 0, w: 0.25, h: 0.25, S: 4.6 },
    { kind: 'dre', cx: 0.05, cy: 0.275, w: 0.20, h: 0.25, S: 6 },
    { kind: 'ondas', cx: -0.225, cy: 0.275, w: 0.30, h: 0.25, S: 8 },
    { kind: 'seguranca', cx: 0.25, cy: 0.225, w: 0.15, h: 0.15, S: 9 },
    /* central por último (por cima); cresce mais devagar e cobre a tela com sobra,
       para a faixa da borda (com as 11 áreas) sair da tela até q = 1 */
    { kind: 'centro', cx: 0, cy: 0, w: 0.25, h: 0.25, S: 4 / (1 - 2 * BAND) }
  ];
  var CENTRO = PANELS[PANELS.length - 1];
  function scaleAt(pn, q) { return 1 + (pn.S - 1) * q; }
  function rectOf(pn, q) {
    var s = scaleAt(pn, q), W = M.sw, H = M.ha;
    var w = pn.w * W * s, h = pn.h * H * s;
    var x = M.ox + pn.cx * W * s - w / 2, y = M.oy + pn.cy * H * s - h / 2;
    return { x: x, y: y, w: w, h: h, s: s };
  }

  var D = 1;
  function R(x0, y0, x1, y1) {                              /* retângulo em px de tela, pixel inteiro */
    var X0 = Math.round(x0 * M.dpr), Y0 = Math.round(y0 * M.dpr), X1 = Math.round(x1 * M.dpr), Y1 = Math.round(y1 * M.dpr);
    if (X1 <= X0 || Y1 <= Y0) return;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  }
  function frame(x0, y0, x1, y1, t) {                       /* contorno de t px de dispositivo */
    var X0 = Math.round(x0 * M.dpr), Y0 = Math.round(y0 * M.dpr), X1 = Math.round(x1 * M.dpr), Y1 = Math.round(y1 * M.dpr);
    ctx.fillRect(X0, Y0, X1 - X0, t); ctx.fillRect(X0, Y1 - t, X1 - X0, t);
    ctx.fillRect(X0, Y0, t, Y1 - Y0); ctx.fillRect(X1 - t, Y0, t, Y1 - Y0);
  }

  function drawPanel(pn, q) {
    var r = rectOf(pn, q);
    var X0 = Math.round(r.x * M.dpr), Y0 = Math.round(r.y * M.dpr), X1 = Math.round((r.x + r.w) * M.dpr), Y1 = Math.round((r.y + r.h) * M.dpr);
    if (X1 <= 0 || Y1 <= 0 || X0 >= canvas.width || Y0 >= canvas.height) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    /* coordenadas do painel: u, v de 0 a 1; m = lado de referência (menor dimensão) */
    var ux = function (u) { return r.x + u * r.w; }, vy = function (v) { return r.y + v * r.h; };
    var m = Math.min(r.w, r.h);
    var sq = function (u, v, side) { var a = side * m / 2; R(ux(u) - a, vy(v) - a, ux(u) + a, vy(v) + a); };
    var t2 = Math.max(1, Math.round(2 * M.dpr)), t1 = Math.max(1, Math.round(M.dpr));
    var k, i, j;

    if (pn.kind === 'centro') {
      ctx.fillStyle = C.paper; R(r.x, r.y, r.x + r.w, r.y + r.h);
      /* grade de hairlines line: passo G/S no painel em 1x, G na tela quando q = 1 */
      ctx.fillStyle = C.line;
      var pitch = (G / pn.S) * r.s, cxs = M.ox, cys = M.oy;
      for (k = Math.ceil((r.x - cxs) / pitch); cxs + k * pitch < r.x + r.w; k++) {
        var gx = Math.round((cxs + k * pitch) * M.dpr); ctx.fillRect(gx, Y0, t1, Y1 - Y0);
      }
      for (k = Math.ceil((r.y - cys) / pitch); cys + k * pitch < r.y + r.h; k++) {
        var gy = Math.round((cys + k * pitch) * M.dpr); ctx.fillRect(X0, gy, X1 - X0, t1);
      }
      /* as 11 áreas do framework na faixa da borda, ligadas para dentro */
      var b = BAND, side = 0.5 * b;
      var mods = [[0.2, b / 2], [0.4, b / 2], [0.6, b / 2], [0.8, b / 2],
                  [1 - b / 2, 0.35], [1 - b / 2, 0.65],
                  [0.7, 1 - b / 2], [0.5, 1 - b / 2], [0.3, 1 - b / 2],
                  [b / 2, 0.65], [b / 2, 0.35]];
      var mw = side * m / 2;
      mods.forEach(function (p, idx) {
        var u = p[0], v = p[1];
        ctx.fillStyle = C['accent-text'];
        /* ligação até a borda interna da faixa */
        if (v < b) R(ux(u) - t1 / M.dpr / 2, vy(v) + mw, ux(u) + t1 / M.dpr / 2, vy(b));
        else if (v > 1 - b) R(ux(u) - t1 / M.dpr / 2, vy(1 - b), ux(u) + t1 / M.dpr / 2, vy(v) - mw);
        else if (u < b) R(ux(u) + mw, vy(v) - t1 / M.dpr / 2, ux(b), vy(v) + t1 / M.dpr / 2);
        else R(ux(1 - b), vy(v) - t1 / M.dpr / 2, ux(u) - mw, vy(v) + t1 / M.dpr / 2);
        ctx.fillStyle = idx === 7 ? C.acid : C.surface;
        R(ux(u) - mw, vy(v) - mw, ux(u) + mw, vy(v) + mw);
        ctx.fillStyle = C['accent-text'];
        frame(ux(u) - mw, vy(v) - mw, ux(u) + mw, vy(v) + mw, t1);
      });
      /* moldura do painel (sai da tela quando ele cobre a tela) */
      ctx.fillStyle = C.accent; frame(r.x, r.y, r.x + r.w, r.y + r.h, t2);
    } else if (pn.kind === 'hotel') {
      ctx.fillStyle = C.accent; R(r.x, r.y, r.x + r.w, r.y + r.h);
      ctx.fillStyle = C.band; R(ux(0.14), vy(0.2), ux(0.86), vy(0.94));
      ctx.fillStyle = C['accent-text']; R(ux(0.1), vy(0.16), ux(0.9), vy(0.2));
      for (i = 0; i < 6; i++) for (j = 0; j < 3; j++) {
        ctx.fillStyle = (i * 3 + j) % 5 === 1 ? C.acid : C.surface;
        R(ux(0.2 + i * 0.105), vy(0.28 + j * 0.2), ux(0.2 + i * 0.105 + 0.06), vy(0.28 + j * 0.2 + 0.12));
      }
      ctx.fillStyle = C.accent; R(ux(0.45), vy(0.8), ux(0.55), vy(0.94));
    } else if (pn.kind === 'areas') {
      ctx.fillStyle = C['icon-bg']; R(r.x, r.y, r.x + r.w, r.y + r.h);
      var n = 0;
      for (j = 0; j < 6; j++) for (i = 0; i < 2; i++) {
        if (n >= 11) break;
        var u0 = 0.18 + i * 0.36, v0 = 0.07 + j * 0.15, sz = 0.28;
        ctx.fillStyle = n === 1 ? C.acid : C.surface;
        R(ux(u0), vy(v0), ux(u0) + sz * r.w, vy(v0) + sz * r.w);
        ctx.fillStyle = C.accent; frame(ux(u0), vy(v0), ux(u0) + sz * r.w, vy(v0) + sz * r.w, t1);
        n++;
      }
    } else if (pn.kind === 'restaurante') {
      ctx.fillStyle = C.band; R(r.x, r.y, r.x + r.w, r.y + r.h);
      for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) {
        var cu = 0.22 + i * 0.28, cv = 0.3 + j * 0.4;
        ctx.fillStyle = C['accent-text'];
        sq(cu, cv - 0.17, 0.07); sq(cu, cv + 0.17, 0.07); sq(cu - 0.1, cv, 0.07); sq(cu + 0.1, cv, 0.07);
        ctx.fillStyle = (i + j) % 3 === 0 ? C.acid : C.surface; sq(cu, cv, 0.2);
      }
    } else if (pn.kind === 'dre') {
      ctx.fillStyle = C.surface; R(r.x, r.y, r.x + r.w, r.y + r.h);
      var hs = [0.32, 0.5, 0.41, 0.66, 0.56, 0.78];
      for (i = 0; i < hs.length; i++) {
        ctx.fillStyle = i === 5 ? C.acid : C.accent;
        R(ux(0.12 + i * 0.13), vy(0.86 - hs[i]), ux(0.12 + i * 0.13 + 0.08), vy(0.86));
      }
      ctx.fillStyle = C['accent-text']; R(ux(0.08), vy(0.86), ux(0.92), vy(0.86) + t2 / M.dpr);
    } else if (pn.kind === 'ondas') {
      ctx.fillStyle = C.accent; R(r.x, r.y, r.x + r.w, r.y + r.h);
      var rows = [[5, C.acid, 0.1], [4, C.band, 0.22], [3, C.surface, 0.34]];
      rows.forEach(function (rw, ri) {
        ctx.fillStyle = rw[1];
        for (var a = 0; a < rw[0]; a++) sq(rw[2] + a * 0.16 + 0.05, 0.22 + ri * 0.28, 0.18);
      });
    } else if (pn.kind === 'seguranca') {
      ctx.fillStyle = C.acid; R(r.x, r.y, r.x + r.w, r.y + r.h);
      ctx.fillStyle = C['accent-text'];
      [0.36, 0.26, 0.16].forEach(function (a) { var h2 = a * m; frame(ux(0.5) - h2, vy(0.5) - h2, ux(0.5) + h2, vy(0.5) + h2, t2); });
      ctx.fillStyle = C.accent; sq(0.5, 0.5, 0.14);
    }
    ctx.restore();
  }

  var lastQ = -1;
  function drawZoom(q, force) {
    if (!ctx || !M.sw) return;
    if (!force && Math.abs(q - lastQ) < 1e-5) return;
    lastQ = q;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.soft; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < PANELS.length; i++) drawPanel(PANELS[i], q);
  }
  function zoomQ(y) { return U.clamp((y - M.zoomTop) / M.zoomLen, 0, 1); }

  function update(y) {
    if (reduced) { drawZoom(0); return; }
    /* em px inteiros, como a rolagem nativa que posiciona os sticky: o mesmo Y dá o
       mesmo quadro, chegando de cima ou de baixo */
    y = Math.round(y);
    updateStack(y);
    drawZoom(zoomQ(y));
  }

  /* ---------------------------------------------------------------------
     Ciclo: medidas no início, a cada refresh do ScrollTrigger (sem travas) e ao
     redimensionar; estado a cada evento de rolagem
     --------------------------------------------------------------------- */
  function refresh() { measure(); stackState = []; lastQ = -1; update(S.scrollY()); }
  if (ST && !reduced) {
    ST.addEventListener('refreshInit', function () { root.classList.remove('pins-on'); });
    ST.addEventListener('refresh', refresh);
  }
  S.onScroll(function (y) { update(y); });
  window.addEventListener('resize', U.debounce(refresh, 140));
  S.fontsReady.then(refresh);
  refresh();

  /* leitura de estado (verificação automatizada; não altera nada) */
  S.p2 = {
    metrics: function () { return JSON.parse(JSON.stringify(M)); },
    zoomQ: function () { return zoomQ(S.scrollY()); },
    panelRects: function (q) { return PANELS.map(function (pn) { var r = rectOf(pn, q === undefined ? zoomQ(S.scrollY()) : q); return { kind: pn.kind, x: r.x, y: r.y, w: r.w, h: r.h, s: r.s }; }); },
    stack: function () {
      return cards.map(function (c, i) {
        var r = c.getBoundingClientRect();
        var vb = svgs[i] ? svgs[i].getAttribute('viewBox').split(' ') : null; return { i: i, top: r.top, left: r.left, width: r.width, height: r.height, scale: r.width / M.Wc, transform: c.style.transform, v: vb ? 400 / parseFloat(vb[2]) : 1 };
      });
    }
  };
})();
