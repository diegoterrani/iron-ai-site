/* =========================================================================
   IRON AI — p2.js (home, parte 2)
   - Camadas que cobrem a anterior (barra: mecanismo 6): cada seção fica presa
     pela base (sticky com top negativo) enquanto a seguinte sobe por cima.
   - Esteira em cartões empilhados (mecanismo 3): cartões ProductCard presos no topo;
     o coberto encolhe (0,96 -> 0,90, pela largura, em px inteiros) e sobe 24 px por
     cartão acima dele; a faixa visível de cada um mostra o visual em accent. O
     visual interno entra em 2x e chega a 1x quando o cartão assenta (viewBox).
   - Transição por zoom (mecanismos 4 e 7): área fixa de 100vh durante 300vh; 6
     painéis de setor e o central crescem de 1x até 4,2–9x em ritmos próprios (os
     rápidos atrás, saindo de trás dos lentos); o central cobre a área sob o header,
     fica em tela cheia (núcleo IRON AI ligado às 11 áreas) e a câmera entra no núcleo,
     que vira o fundo dos casos de uso (mesma grade, mesmo passo e fase; mecanismo 6).
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
      setupZoom();
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
     Zoom (barra: mecanismos 4 e 7). Área fixa de 100vh durante 300vh; p vai de 0 a 1:
     - p 0 a 0,6: os 7 painéis crescem de 1x até 4,2–9x, cada um no seu ritmo (os de
       fora em linha reta; o central mais devagar, em q^1,5) e o central cobre a área
       sob o header em q = 1;
     - p 0,6 a 0,8: clímax, o central em tela cheia: o núcleo IRON AI ligado às 11
       áreas, em accent, com cartões claros (mídia em valor pleno);
     - p 0,8 a 1: a câmera entra no núcleo (paper + grade de hairlines) até ele cobrir
       a tela. É a mesma grade, no mesmo passo e fase, do fundo dos casos de uso.
     Campos saturados (accent / accent-text) com figuras claras e rótulo de 12px ou
     mais em cada painel. Desenho em pixel inteiro, só tokens, sem opacidade.
     --------------------------------------------------------------------- */
  var P1 = 0.6, P2 = 0.8;
  var PANELS = [], CEN = null;
  var AREAS = ['Estratégia e governança de IA', 'Dados', 'Pessoas e cultura', 'Finanças e controladoria',
    'Compras e suprimentos', 'Operações', 'Comercial e marketing', 'Atendimento', 'RH',
    'Jurídico e compliance', 'TI e segurança'];
  var FONT = (getComputedStyle(root).getPropertyValue('--font-sans') || 'sans-serif').trim();

  /* retângulo de cada painel em fração da área visível (largura W, altura H - header),
     a partir do centro dela: [x0, x1, y0, y1]; S = escala no fim do zoom */
  function setupZoom() {
    var land = M.sw >= M.ha;
    var top = -0.5 + (M.W <= 760 ? 22 : 32) / M.ha;          /* primeiro bloco a 32/22 px da borda */
    M.orient = land ? 'paisagem' : 'retrato';
    /* de trás para a frente: os mais rápidos atrás, o central na frente. Cada painel
       começa com a borda interna escondida atrás dos da frente e "sai" de trás deles
       ao crescer mais depressa (paralaxe): os rápidos ficam na tela até 5–9x */
    if (land) {
      PANELS = [
        { kind: 'seguranca', label: 'Segurança', r: [0.06, 0.44, 0.06, 0.42], S: 9, corner: 'br' },
        { kind: 'ondas', label: 'Ondas', r: [-0.44, -0.04, 0.10, 0.42], S: 8, corner: 'bl' },
        { kind: 'dre', label: 'DRE', r: [-0.10, 0.20, 0.08, 0.42], S: 7, corner: 'bl' },
        { kind: 'areas', label: '11 áreas', r: [-0.44, -0.09, -0.32, 0.14], S: 6, corner: 'tl' },
        { kind: 'hotel', label: 'Hotelaria', r: [-0.20, 0.34, top, -0.09], S: 4.6, corner: 'tl' },
        { kind: 'restaurante', label: 'Restaurantes', r: [0.10, 0.44, -0.16, 0.12], S: 4.2, corner: 'tr' },
        { kind: 'centro', label: 'Qualquer setor', r: [-0.125, 0.125, -0.125, 0.125] }
      ];
    } else {
      /* retrato: o central é o maior painel, o mais central e o da frente */
      PANELS = [
        { kind: 'dre', label: 'DRE', r: [0.06, 0.48, -0.12, 0.14], S: 9, corner: 'mr' },
        { kind: 'areas', label: '11 áreas', r: [-0.48, -0.06, -0.14, 0.12], S: 8, corner: 'ml' },
        { kind: 'ondas', label: 'Ondas', r: [-0.48, 0.02, 0.08, 0.46], S: 5.4, corner: 'bl' },
        { kind: 'seguranca', label: 'Segurança', r: [-0.02, 0.48, 0.09, 0.46], S: 5, corner: 'br' },
        { kind: 'hotel', label: 'Hotelaria', r: [-0.48, 0.04, top, -0.09], S: 4.6, corner: 'tl' },
        { kind: 'restaurante', label: 'Restaurantes', r: [-0.02, 0.48, -0.40, -0.08], S: 4.2, corner: 'tr' },
        { kind: 'centro', label: 'Qualquer setor', r: [-0.20, 0.20, -0.20, 0.20] }
      ];
    }
    CEN = PANELS[PANELS.length - 1];
    /* o central cobre a área visível em s = Sc; o núcleo (metade do painel) cobre a
       tela em 2·Sc, no fim do trecho fixo */
    CEN.S = 0.5 / Math.min(-CEN.r[0], CEN.r[1], -CEN.r[2], CEN.r[3]);
    CEN.nu = land ? [0.25, 0.75] : [0.30, 0.70]; CEN.nv = [0.25, 0.75];
    CEN.Send = CEN.S / Math.min(CEN.nu[1] - CEN.nu[0], CEN.nv[1] - CEN.nv[0]);
    /* cartões das 11 áreas no anel do central (u, v do centro; largura, altura): 4 à
       direita, 4 à esquerda, 3 embaixo; em cima, o rótulo "IRON AI / Qualquer setor" */
    var cw, ch, bw, pos, sv = [0.32, 0.44, 0.56, 0.68];
    var su;
    if (land) { su = 0.125; cw = 0.15; ch = 0.11; bw = 0.15; pos = [[0.3, 0.875], [0.5, 0.875], [0.7, 0.875]]; CEN.cardFont = 15; }
    else { su = 0.155; cw = 0.27; ch = 0.10; bw = 0.21; pos = [[0.27, 0.875], [0.5, 0.875], [0.73, 0.875]]; CEN.cardFont = 13; }
    var all = [];
    sv.forEach(function (v) { all.push([su, v, cw]); });
    sv.forEach(function (v) { all.push([1 - su, v, cw]); });
    pos.forEach(function (p) { all.push([p[0], p[1], bw]); });
    pos = all;
    var order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    CEN.cards = pos.map(function (p, i) { return { u: p[0], v: p[1], w: p[2], h: ch, name: AREAS[order[i]] }; });
  }

  function rectOf(pn, s, shift) {
    var x0 = M.ox + pn.r[0] * M.sw * s, x1 = M.ox + pn.r[1] * M.sw * s;
    var cy = M.oy - (shift || 0);
    var y0 = cy + pn.r[2] * M.ha * s, y1 = cy + pn.r[3] * M.ha * s;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, s: s };
  }
  function zoomState(p) {
    var q = U.clamp(p / P1, 0, 1), sc, phase;
    if (p <= P1) { sc = 1 + (CEN.S - 1) * Math.pow(q, 1.5); phase = 'zoom'; }
    else if (p <= P2) { sc = CEN.S * (1 + 0.06 * (p - P1) / (P2 - P1)); phase = 'clímax'; }
    else { sc = 1.06 * CEN.S + (CEN.Send - 1.06 * CEN.S) * (p - P2) / (1 - P2); phase = 'núcleo'; }
    return { p: p, q: q, phase: phase, s: PANELS.map(function (pn) { return pn === CEN ? sc : 1 + (pn.S - 1) * q; }) };
  }
  function zoomP(y) { return U.clamp((y - M.zoomTop) / M.zoomLen, 0, 1); }

  /* desenho em px de dispositivo, sempre em pixel inteiro */
  /* bordas da área visível (px CSS, coordenadas do canvas): um bloco cortado por uma
     delas que ficaria com menos de 8 px visíveis não é desenhado (sem lasca colada
     no header ou nas laterais) */
  var EDGE = { t: 0, b: 1e9, l: 0, r: 1e9 }, SLIVER = 8;
  function R(x0, y0, x1, y1) {
    if ((y0 < EDGE.t && y1 > EDGE.t && y1 - EDGE.t < SLIVER) || (y0 < EDGE.b && y1 > EDGE.b && EDGE.b - y0 < SLIVER) ||
        (x0 < EDGE.l && x1 > EDGE.l && x1 - EDGE.l < SLIVER) || (x0 < EDGE.r && x1 > EDGE.r && EDGE.r - x0 < SLIVER)) return false;
    var X0 = Math.round(x0 * M.dpr), Y0 = Math.round(y0 * M.dpr), X1 = Math.round(x1 * M.dpr), Y1 = Math.round(y1 * M.dpr);
    if (X1 <= X0 || Y1 <= Y0) return false;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    return true;
  }
  function frame(x0, y0, x1, y1, t) {
    var X0 = Math.round(x0 * M.dpr), Y0 = Math.round(y0 * M.dpr), X1 = Math.round(x1 * M.dpr), Y1 = Math.round(y1 * M.dpr);
    ctx.fillRect(X0, Y0, X1 - X0, t); ctx.fillRect(X0, Y1 - t, X1 - X0, t);
    ctx.fillRect(X0, Y0, t, Y1 - Y0); ctx.fillRect(X1 - t, Y0, t, Y1 - Y0);
  }
  /* rótulo: etiqueta acid com texto em text (contraste 12:1), font em px CSS */
  function chip(lines, x, y, f) {
    var pad = Math.round(0.55 * f), lh = Math.round(1.35 * f), w = 0;
    ctx.font = '700 ' + Math.round(f * M.dpr) + 'px ' + FONT;
    lines.forEach(function (t) { w = Math.max(w, ctx.measureText(t).width / M.dpr); });
    var cwid = Math.ceil(w) + 2 * pad, chh = lines.length * lh + Math.round(0.6 * f);
    ctx.fillStyle = C.acid; if (!R(x, y, x + cwid, y + chh)) return { w: cwid, h: chh };
    ctx.fillStyle = C.text; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    lines.forEach(function (t, i) {
      ctx.fillText(t, Math.round((x + pad) * M.dpr), Math.round((y + Math.round(0.3 * f) + lh * (i + 0.5)) * M.dpr));
    });
    return { w: cwid, h: chh };
  }
  function wrap(text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (wd) {
      var t = cur ? cur + ' ' + wd : wd;
      if (cur && ctx.measureText(t).width / M.dpr > maxW) { lines.push(cur); cur = wd; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawPanel(pn, s, shift, vTop, vBot) {
    var r = rectOf(pn, s, shift);
    /* parte visível (sob o header); um resto menor que 12 px não é desenhado (sem lascas) */
    var ix = Math.min(r.x + r.w, M.sw) - Math.max(r.x, 0), iy = Math.min(r.y + r.h, vBot) - Math.max(r.y, vTop);
    if (ix <= 0 || iy <= 0) return;
    if (pn !== CEN && (ix < 12 || iy < 12)) return;
    var X0 = Math.round(r.x * M.dpr), Y0 = Math.round(r.y * M.dpr), X1 = Math.round((r.x + r.w) * M.dpr), Y1 = Math.round((r.y + r.h) * M.dpr);
    /* vão: uma borda do fundo em volta, para o painel da frente se separar do de trás */
    var gw = 5 * s;
    if (pn === CEN) {                                       /* perto de cobrir, o vão do central afina */
      var mm = Math.min(Math.max(0, r.x), Math.max(0, M.sw - r.x - r.w), Math.max(0, r.y - vTop), Math.max(0, vBot - r.y - r.h));
      gw = Math.min(gw, mm / 3);
    }
    gw = Math.round(gw * M.dpr);
    ctx.fillStyle = C.soft; ctx.fillRect(X0 - gw, Y0 - gw, X1 - X0 + 2 * gw, Y1 - Y0 + 2 * gw);
    ctx.save();
    ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    var ux = function (u) { return r.x + u * r.w; }, vy = function (v) { return r.y + v * r.h; };
    var m = Math.min(r.w, r.h);
    var sq = function (u, v, side) { var a = side * m / 2; R(ux(u) - a, vy(v) - a, ux(u) + a, vy(v) + a); };
    var t1 = Math.max(1, Math.round(M.dpr));
    var i, j, k;

    if (pn === CEN) { drawCentro(r, s, shift, ux, vy, t1); ctx.restore(); return; }

    ctx.fillStyle = C['accent-text']; R(r.x, r.y, r.x + r.w, r.y + r.h);
    /* desenho em toda a área do painel (só a parte de fora aparece no começo) */
    var bu = function (a) { return 0.06 + a * 0.88; }, bv = function (a) { return 0.06 + a * 0.88; };
    if (pn.kind === 'hotel') {
      ctx.fillStyle = C.surface; R(ux(bu(0)), vy(bv(0.1)), ux(bu(1)), vy(bv(1)));
      ctx.fillStyle = C.band; R(ux(0), vy(bv(0)), ux(1), vy(bv(0.1)));
      for (i = 0; i < 9; i++) for (j = 0; j < 4; j++) {
        ctx.fillStyle = (i * 4 + j) % 5 === 2 ? C.acid : C.accent;
        R(ux(bu(0.05 + i * 0.106)), vy(bv(0.2 + j * 0.2)), ux(bu(0.05 + i * 0.106 + 0.06)), vy(bv(0.2 + j * 0.2 + 0.12)));
      }
    } else if (pn.kind === 'areas') {
      var n = 0;
      for (j = 0; j < 4 && n < 11; j++) for (i = 0; i < 3 && n < 11; i++) {
        ctx.fillStyle = n === 4 ? C.acid : C.surface;
        R(ux(bu(i / 3 + 0.03)), vy(bv(j / 4 + 0.03)), ux(bu((i + 1) / 3 - 0.03)), vy(bv((j + 1) / 4 - 0.03)));
        n++;
      }
    } else if (pn.kind === 'restaurante') {
      for (i = 0; i < 4; i++) for (j = 0; j < 2; j++) {
        var cxp = ux(bu(0.125 + i * 0.25)), cyp = vy(bv(0.27 + j * 0.5)), tw = 0.07 * r.w, th = 0.1 * r.h, d = Math.min(tw, th);
        ctx.fillStyle = C.surface;
        R(cxp - d * 0.4, cyp - th - d * 0.8, cxp + d * 0.4, cyp - th - d * 0.2);
        R(cxp - d * 0.4, cyp + th + d * 0.2, cxp + d * 0.4, cyp + th + d * 0.8);
        ctx.fillStyle = (i + j) % 3 === 0 ? C.band : C.acid; R(cxp - tw, cyp - th, cxp + tw, cyp + th);
      }
    } else if (pn.kind === 'dre') {
      var hs = [0.3, 0.46, 0.38, 0.58, 0.5, 0.7, 0.62, 0.9];
      for (i = 0; i < hs.length; i++) {
        ctx.fillStyle = i === hs.length - 1 ? C.acid : C.surface;
        R(ux(bu(0.02 + i * 0.123)), vy(bv(0.92 - hs[i] * 0.86)), ux(bu(0.02 + i * 0.123 + 0.08)), vy(bv(0.92)));
      }
      ctx.fillStyle = C.band; R(ux(0), vy(bv(0.92)), ux(1), vy(bv(0.97)));
    } else if (pn.kind === 'ondas') {
      var rows = [[6, C.acid], [5, C.band], [4, C.surface]];
      rows.forEach(function (rw, ri) {
        ctx.fillStyle = rw[1];
        for (var a = 0; a < rw[0]; a++) R(ux(bu(a * 0.165 + ri * 0.08)), vy(bv(ri / 3 + 0.05)), ux(bu(a * 0.165 + ri * 0.08 + 0.13)), vy(bv((ri + 1) / 3 - 0.05)));
      });
    } else if (pn.kind === 'seguranca') {
      var cxs = ux(pn.corner.charAt(1) === 'r' ? 0.66 : 0.34), cys = vy(pn.corner.charAt(0) === 'b' ? 0.62 : 0.38), hm = Math.min(r.w, r.h) * 0.3;
      ctx.fillStyle = C.band; R(cxs - hm, cys - hm, cxs + hm, cys + hm);
      ctx.fillStyle = C['accent-text']; R(cxs - hm * 0.78, cys - hm * 0.78, cxs + hm * 0.78, cys + hm * 0.78);
      ctx.fillStyle = C.surface; R(cxs - hm * 0.58, cys - hm * 0.58, cxs + hm * 0.58, cys + hm * 0.58);
      ctx.fillStyle = C['accent-text']; R(cxs - hm * 0.4, cys - hm * 0.4, cxs + hm * 0.4, cys + hm * 0.4);
      ctx.fillStyle = C.acid; R(cxs - hm * 0.22, cys - hm * 0.22, cxs + hm * 0.22, cys + hm * 0.22);
    }
    /* rótulo no canto de fora (o que aparece desde o começo): 12px em s = 1 */
    var f = 12 * s, off = 8 * s;
    ctx.font = '700 ' + Math.round(f * M.dpr) + 'px ' + FONT;
    var cwid = Math.ceil(ctx.measureText(pn.label).width / M.dpr) + 2 * Math.round(0.55 * f), chh = Math.round(1.35 * f) + Math.round(0.6 * f);
    var lx = pn.corner.charAt(1) === 'r' ? r.x + r.w - off - cwid : r.x + off;
    var ly = pn.corner.charAt(0) === 'b' ? r.y + r.h - off - chh : (pn.corner.charAt(0) === 'm' ? r.y + r.h / 2 - chh / 2 : r.y + off);
    ctx.fillStyle = C['accent-text']; R(lx - 4 * s, ly - 4 * s, lx + cwid + 4 * s, ly + chh + 4 * s);
    chip([pn.label], lx, ly, f);
    ctx.restore();
  }

  /* central: campo accent, núcleo (paper + grade) no meio, 11 áreas no anel, ligadas a
     ele; rótulo "IRON AI / Qualquer setor" no canto */
  function drawCentro(r, s, shift, ux, vy, t1) {
    ctx.fillStyle = C.accent; R(r.x, r.y, r.x + r.w, r.y + r.h);
    var k = s / CEN.S;                                       /* 1 no clímax */
    /* núcleo: grade com passo G na tela quando ele cobre a tela (s = Send) */
    var nx0 = ux(CEN.nu[0]), nx1 = ux(CEN.nu[1]), ny0 = vy(CEN.nv[0]), ny1 = vy(CEN.nv[1]);
    ctx.fillStyle = C.paper; R(nx0, ny0, nx1, ny1);
    ctx.fillStyle = C.line;
    var pitch = (G / CEN.Send) * s, cxs = M.ox, cys = M.oy - shift;
    var NX0 = Math.round(nx0 * M.dpr), NX1 = Math.round(nx1 * M.dpr), NY0 = Math.round(ny0 * M.dpr), NY1 = Math.round(ny1 * M.dpr);
    if (pitch >= 3) {
      var a;
      for (a = Math.ceil((nx0 - cxs) / pitch); cxs + a * pitch < nx1; a++) ctx.fillRect(Math.round((cxs + a * pitch) * M.dpr), NY0, t1, NY1 - NY0);
      for (a = Math.ceil((ny0 - cys) / pitch); cys + a * pitch < ny1; a++) ctx.fillRect(NX0, Math.round((cys + a * pitch) * M.dpr), NX1 - NX0, t1);
    }
    /* ligações (band) e cartões das áreas (surface, texto em text quando ≥ 12px) */
    var lw = Math.max(1, Math.round(2 * k)), fpx = CEN.cardFont * k;
    CEN.cards.forEach(function (c) {
      var x0 = ux(c.u - c.w / 2), x1 = ux(c.u + c.w / 2), y0 = vy(c.v - c.h / 2), y1 = vy(c.v + c.h / 2);
      var mx = ux(c.u), my = vy(c.v), h2 = lw / 2;
      ctx.fillStyle = C.band;
      if (c.v > 0.75) R(mx - h2, ny1, mx + h2, y0);
      else if (c.u > 0.5) R(nx1, my - h2, x0, my + h2);
      else R(x1, my - h2, nx0, my + h2);
      ctx.fillStyle = C.surface; if (!R(x0, y0, x1, y1)) return;
      /* texto em text, do maior tamanho que couber (nunca abaixo de 12px) */
      var fz = Math.floor(fpx + 1e-6), lines = null, lh = 0;
      while (fz >= 12) {
        ctx.font = '600 ' + Math.round(fz * M.dpr) + 'px ' + FONT;
        lines = wrap(c.name, (x1 - x0) - 2 * Math.max(5, 0.5 * fz)); lh = Math.round(fz * 1.28);
        var wmax = 0; lines.forEach(function (t) { wmax = Math.max(wmax, ctx.measureText(t).width / M.dpr); });
        if (lines.length * lh <= (y1 - y0) - 6 && wmax <= (x1 - x0) - 6) break;
        fz -= 1; lines = null;
      }
      if (lines) {
        ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        lines.forEach(function (t, i) {
          ctx.fillText(t, Math.round(mx * M.dpr), Math.round((my + (i - (lines.length - 1) / 2) * lh) * M.dpr));
        });
      }
    });
    ctx.textAlign = 'left';
    /* rótulo do central, em cima e ligado ao núcleo: cresce mais devagar que o painel
       (12px em s = 1) e sai pela borda de cima quando a câmera entra no núcleo */
    var f = 12 * (1 + 0.3 * (s - 1));
    ctx.font = '700 ' + Math.round(f * M.dpr) + 'px ' + FONT;
    var tw = Math.max(ctx.measureText('IRON AI').width, ctx.measureText(CEN.label).width) / M.dpr;
    var cwid = Math.ceil(tw) + 2 * Math.round(0.55 * f), chh = 2 * Math.round(1.35 * f) + Math.round(0.6 * f);
    var cx0 = ux(0.5) - cwid / 2, cy0 = vy(0.125) - chh / 2;
    ctx.fillStyle = C.band; R(ux(0.5) - lw / 2, cy0 + chh, ux(0.5) + lw / 2, ny0);
    chip(['IRON AI', CEN.label], cx0, cy0, f);
  }

  /* acabamento das bordas da área visível: uma faixa de menos de 8 px colada no header
     ou nas laterais (resto de bloco cortado, vão, campo entre dois blocos) é coberta
     pelo bloco que vem logo depois dela, coluna a coluna (ou linha a linha) */
  var LINE = U.rgb(U.token('--line') || '#dddbe9'), PAPER = U.rgb(U.token('--paper') || '#fbfbfd'), TOK = {};
  ['paper', 'soft', 'surface', 'band', 'acid', 'accent', 'accent-text', 'line', 'text'].forEach(function (n) {
    var c = U.rgb(U.token('--' + n) || '#000000'); TOK[(c[0] << 16) | (c[1] << 8) | c[2]] = true;
  });
  function edgeClean(vTop, vBot) {
    var d = Math.max(1, Math.round(SLIVER * M.dpr)), Wd = canvas.width, Hd = canvas.height;
    var T = Math.round(vTop * M.dpr), B = Math.round(vBot * M.dpr);
    function band(x, y, w, h, vertical, fromEnd) {
      if (w <= 0 || h <= 0) return;
      var img = ctx.getImageData(x, y, w, h), a = img.data, n = vertical ? w : h, len = vertical ? h : w, changed = false;
      for (var i = 0; i < n; i++) {
        var idx = function (k) { var kk = fromEnd ? len - 1 - k : k; return vertical ? (kk * w + i) * 4 : (i * w + kk) * 4; };
        var j = idx(len - 1), r = a[j], g = a[j + 1], b = a[j + 2];
        if (!TOK[(r << 16) | (g << 8) | b]) continue;          /* só estende cor de token (nunca antialias de texto) */
        var k = len - 1;
        while (k > 0) { var q = idx(k - 1); if (a[q] !== r || a[q + 1] !== g || a[q + 2] !== b) break; k--; }
        if (k > 0) {
          /* fio da grade (line) sobre paper fica: é a grade de hairlines, não lasca */
          var isGrid = function (t) { return (a[t] === LINE[0] && a[t + 1] === LINE[1] && a[t + 2] === LINE[2]) || (a[t] === PAPER[0] && a[t + 1] === PAPER[1] && a[t + 2] === PAPER[2]); };
          var grid = isGrid(j);
          for (var m0 = 0; m0 < k && grid; m0++) grid = isGrid(idx(m0));
          if (grid) continue;
          changed = true; for (var m = 0; m < k; m++) { var t = idx(m); a[t] = r; a[t + 1] = g; a[t + 2] = b; a[t + 3] = 255; }
        }
      }
      if (changed) ctx.putImageData(img, x, y);
    }
    band(0, T, Wd, Math.min(d + 1, B - T), true, false);              /* sob o header */
    band(0, Math.max(T, B - d - 1), Wd, Math.min(d + 1, B - T), true, true);   /* base da tela */
    band(0, T, Math.min(d + 1, Wd), B - T, false, false);             /* esquerda */
    band(Math.max(0, Wd - d - 1), T, Math.min(d + 1, Wd), B - T, false, true); /* direita */
  }

  var lastKey = '';
  function drawZoom(p, rise) {
    if (!ctx || !M.sw || !CEN) return;
    var key = p.toFixed(5) + '|' + rise;
    if (key === lastKey) return;
    lastKey = key;
    var zs = zoomState(p);
    /* enquanto a camada sobe, o desenho sobe junto o tanto do header, para o primeiro
       bloco ficar a 32/22 px da borda; ao travar, ele volta para baixo do header */
    var shift = Math.round(M.hdr * Math.min(1, rise / M.hdr));
    var vTop = Math.max(0, M.hdr - rise), vBot = Math.min(M.sh, M.H - rise);
    EDGE.t = vTop; EDGE.b = vBot; EDGE.l = 0; EDGE.r = M.sw;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.soft; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < PANELS.length; i++) drawPanel(PANELS[i], zs.s[i], shift, vTop, vBot);
    /* o central, perto de cobrir: uma sobra menor que 18 px entre ele e a borda vira
       campo accent (sem lasca do fundo ou de painel de trás); o conteúdo não se move */
    var c = rectOf(CEN, zs.s[PANELS.length - 1], shift), T = 18;
    var ml = c.x, mr = M.sw - (c.x + c.w), mt = c.y - vTop, mb = vBot - (c.y + c.h);
    var fl = ml > 0 && ml < T, fr = mr > 0 && mr < T, ft = mt > 0 && mt < T, fb = mb > 0 && mb < T;
    ctx.fillStyle = C.accent;
    var ya = ft ? vTop : Math.max(vTop, c.y), yb = fb ? vBot : Math.min(vBot, c.y + c.h);
    var xa = fl ? 0 : Math.max(0, c.x), xb = fr ? M.sw : Math.min(M.sw, c.x + c.w);
    if (fl) R(0, ya, c.x, yb);
    if (fr) R(c.x + c.w, ya, M.sw, yb);
    if (ft) R(xa, vTop, xb, c.y);
    if (fb) R(xa, c.y + c.h, xb, vBot);
    edgeClean(vTop, vBot);
  }

  function update(y) {
    if (reduced) { drawZoom(0, 0); return; }
    /* em px inteiros, como a rolagem nativa que posiciona os sticky: o mesmo Y dá o
       mesmo quadro, chegando de cima ou de baixo */
    y = Math.round(y);
    updateStack(y);
    drawZoom(zoomP(y), Math.max(0, Math.round(M.zoomTop - y)));
  }

  /* ---------------------------------------------------------------------
     Ciclo: medidas no início, a cada refresh do ScrollTrigger (sem travas) e ao
     redimensionar; estado a cada evento de rolagem
     --------------------------------------------------------------------- */
  function refresh() { measure(); stackState = []; lastKey = ''; update(S.scrollY()); }
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
    zoomP: function () { return zoomP(S.scrollY()); },
    zoomState: function (p) { return zoomState(p === undefined ? zoomP(S.scrollY()) : p); },
    panelRects: function (p) { var zs = zoomState(p === undefined ? zoomP(S.scrollY()) : p); return PANELS.map(function (pn, i) { var r = rectOf(pn, zs.s[i], 0); return { kind: pn.kind, label: pn.label, S: pn === CEN ? CEN.Send : pn.S, x: r.x, y: r.y, w: r.w, h: r.h, s: zs.s[i] }; }); },
    stack: function () {
      return cards.map(function (c, i) {
        var r = c.getBoundingClientRect();
        var vb = svgs[i] ? svgs[i].getAttribute('viewBox').split(' ') : null; return { i: i, top: r.top, left: r.left, width: r.width, height: r.height, scale: r.width / M.Wc, transform: c.style.transform, v: vb ? 400 / parseFloat(vb[2]) : 1 };
      });
    }
  };
})();
