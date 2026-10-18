/* =========================================================================
   IRON AI — visuals.js
   Visuais feitos em código (canvas). Nenhuma imagem externa.

   IronVisuals.createAILayer(canvas, opts)
     "A IA nas 11 áreas do negócio": uma cena fixa do tamanho da tela inteira
     (o "mundo"), vista por uma janela (a mídia do hero) e por uma câmera.

     Mundo (não se reorganiza em nenhum momento):
       - espinha central: 01 Estratégia e governança de IA, 02 Dados, o núcleo
         IRON AI (laje acid com a grade de nós da capa), R$ Resultado medido no
         DRE, 04 Finanças e controladoria;
       - as outras 8 áreas em volta (colunas no desktop, fileiras no celular);
       - fluxos ortogonais áreas <-> núcleo, linhas de entrada que chegam das
         bordas da tela (os sistemas que a empresa já tem) e um anel entre as áreas.

     Janela e câmera (progresso p, 0..1):
       - a janela cresce nas duas dimensões, do retângulo inicial à tela inteira;
       - a câmera vai de um enquadramento da espinha (z0) para 1x; a grade do
         campo anda mais devagar (zg) que cartões e núcleo;
       - todo cartão é desenhado inteiro (caixa, índice, rótulo) e a janela o
         recorta como uma câmera; em repouso nenhum cartão está cortado;
       - as áreas de fora chegam deslizando pelas próprias linhas até o lugar e
         assentam em p = 1; nas paradas da roda nenhum recorte é um filete;
       - rótulos com 12 px ou mais na tela em todo p.

     Cena de fundo (drawScene): grade de hairlines `line` sobre paper em todo o
     palco (a mesma grade do campo, continuada além da janela) e linhas de entrada
     tracejadas até as bordas da tela; o painel a cobre ao crescer, sem opacidade.

   Paleta (esclarecimento "Ilustração e mídia em código"): accent, accent-text,
   acid, band, surface, text, line. Tudo quadrado, sem gradiente, sem sombra.
   ========================================================================= */
(function () {
  'use strict';

  var S = window.IronSite;
  if (!S) return;
  var U = S.util;

  var AREAS = [
    ['ESTRATÉGIA E', 'GOVERNANÇA DE IA'],
    ['DADOS'],
    ['PESSOAS E', 'CULTURA'],
    ['FINANÇAS E', 'CONTROLADORIA'],
    ['COMPRAS E', 'SUPRIMENTOS'],
    ['OPERAÇÕES'],
    ['COMERCIAL E', 'MARKETING'],
    ['ATENDIMENTO'],
    ['RH'],
    ['JURÍDICO E', 'COMPLIANCE'],
    ['TI E', 'SEGURANÇA']
  ];
  var DRE_LABEL = ['RESULTADO', 'MEDIDO NO DRE'];
  var DRE = 11;
  var MONO = '"IBM Plex Mono", ui-monospace, monospace';
  var SANS = 'Manrope, system-ui, sans-serif';

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- polilinhas ortogonais ---------- */
  function poly(points) {
    var pts = [points[0]];
    for (var i = 1; i < points.length; i++) {
      var a = pts[pts.length - 1], b = points[i];
      if (Math.abs(a.x - b.x) > 0.01 || Math.abs(a.y - b.y) > 0.01) pts.push(b);
    }
    var cum = [0];
    for (i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y));
    }
    return { pts: pts, cum: cum, len: cum[cum.length - 1] || 1 };
  }
  function pointAt(pl, u) {
    u = U.clamp(u, 0, pl.len);
    for (var i = 1; i < pl.pts.length; i++) {
      if (u <= pl.cum[i]) {
        var seg = pl.cum[i] - pl.cum[i - 1] || 1;
        var t = (u - pl.cum[i - 1]) / seg;
        return { x: U.lerp(pl.pts[i - 1].x, pl.pts[i].x, t), y: U.lerp(pl.pts[i - 1].y, pl.pts[i].y, t) };
      }
    }
    return pl.pts[pl.pts.length - 1];
  }
  function readColors() {
    var t = function (n, fb) { return U.rgb(U.token(n) || fb); };
    return {
      accent: t('--accent', '#5547c4'), accentText: t('--accent-text', '#4a3db3'),
      acid: t('--acid', '#cdc5fb'), band: t('--band', '#e9e6fb'), surface: t('--surface', '#efeef7'),
      text: t('--text', '#16151f'), line: t('--line', '#dddbe9')
    };
  }

  function createAILayer(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: true });
    var C = readColors();
    var W = 0, H = 0, dpr = 1, portrait = false;
    var start = { w: 0.45, h: 0.65, cy: 0.5 };
    var staticRect = null;
    var sim = null, world = null;
    var labelW10 = 0;
    var z0 = 1, zg0 = 1;

    /* ---------- simulação (independente do enquadramento) ---------- */
    function initSim() {
      var rand = rng(20261018);
      var NX = portrait ? 11 : 15, NY = portrait ? 6 : 6;
      var s = { NX: NX, NY: NY, packets: [], agents: [], flashes: [], nodeFlash: [], ring: [] };
      for (var i = 0; i < 12; i++) {
        s.nodeFlash.push(-10);
        if (i === DRE) {
          for (var k = 0; k < 3; k++) s.packets.push({ c: i, edge: false, dir: -1, speed: 0.34 + rand() * 0.1, gap: 0.3 + rand() * 0.3, phase: rand() + k * 0.45, kind: 'acid', n: null });
        } else {
          s.packets.push({ c: i, edge: false, dir: 1, speed: 0.26 + rand() * 0.16, gap: 0.4 + rand() * 0.8, phase: rand() * 2, kind: 'acid', n: null });
          s.packets.push({ c: i, edge: false, dir: -1, speed: 0.22 + rand() * 0.14, gap: 0.6 + rand() * 1.0, phase: rand() * 2, kind: 'paper', n: null });
          s.packets.push({ c: i, edge: true, dir: 1, speed: 0.18 + rand() * 0.12, gap: 0.5 + rand() * 0.9, phase: rand() * 2, kind: 'acid', n: null });
        }
      }
      for (var a = 0; a < (portrait ? 3 : 4); a++) {
        var gx = 1 + Math.floor(rand() * (NX - 2)), gy = 1 + Math.floor(rand() * (NY - 2));
        s.agents.push({ gx: gx, gy: gy, fx: gx, fy: gy, t0: -rand() * 2, dur: 0.5, wait: 0.3, trail: [], rand: rng(97 + a * 31) });
      }
      for (var r = 0; r < 4; r++) s.ring.push(r / 4);
      s.extra = [];
      for (var x = 0; x < 4; x++) s.extra.push({ speed: 0.16 + rand() * 0.1, gap: 0.6 + rand() * 0.8, phase: rand() * 2 });
      return s;
    }

    /* largura de cada linha de rótulo a 10 px (com o tracking de 0,06em) */
    var lineW10 = {};
    function measureLabels() {
      ctx.save();
      ctx.font = '600 10px ' + MONO;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px';
      var m = 0;
      AREAS.concat([DRE_LABEL]).forEach(function (lines) {
        lines.forEach(function (l) { var w = ctx.measureText(l).width; lineW10[l] = w; m = Math.max(m, w); });
      });
      ctx.restore();
      labelW10 = m || 112;
      if (world) typeWorld(world);
    }
    function widest10(c) {
      var m = 0;
      c.label.forEach(function (l) { m = Math.max(m, lineW10[l] || l.length * 6.6); });
      return m;
    }

    /* tipografia de um cartão (em unidades do mundo): o rótulo cabe inteiro.
       Todos os rótulos usam o mesmo corpo: o menor que cabe em todos os cartões. */
    function cardType(c, fsIdx) {
      var padX = U.clamp(c.w * 0.07, 7, 14);
      var idxCol = fsIdx * 1.35 + padX * 0.8;
      var status = U.clamp(c.h * 0.1, 4, 7);
      var avail = c.w - padX - idxCol - (status + padX);
      c.padX = padX; c.fsIdx = fsIdx; c.idxCol = idxCol; c.status = status;
      c.fsFit = Math.min(16, 10 * avail / widest10(c), (c.h - 12) / (2 * 1.3));
    }
    function typeWorld(w) {
      var minFit = function () { return Math.min.apply(null, w.cards.map(function (c) { return c.fsFit; })); };
      w.cards.forEach(function (c) { cardType(c, 13); });
      var fs = minFit();
      /* o índice usa o mesmo corpo do rótulo */
      w.cards.forEach(function (c) { cardType(c, fs); });
      fs = Math.min(fs, minFit());
      w.fs = fs;
      w.cards.forEach(function (c) { c.fs = fs; c.fsIdx = fs; });
    }

    /* ---------- mundo: a composição em tela cheia (coordenadas da tela, z = 1) ----------
       Escolhida pelo tamanho da tela e fixa durante toda a expansão:
       - 'cols'    (paisagem): espinha no centro, 4 áreas em cada coluna lateral (abaixo de
                   1000 px, espinha compacta e colunas mais estreitas);
       - 'portrait': espinha no centro, 2 fileiras de 2 áreas acima e 2 abaixo;
       - 'short'   (retrato baixo): igual, com 01 e 04 afastados da espinha — em repouso a
                   janela mostra 02, o núcleo e o DRE com rótulos de 12 px ou mais.
       Em repouso, todo cartão fica inteiro dentro da janela ou inteiro fora dela. */
    var layout = 'cols';
    var tune = { col: 0, t0: 0, t1: 0, b0: 0, b1: 0, e: 0, f: 0, d: 0, r: 0 };
    /* fator do deslizamento de entrada por grupo (1 = padrão); ajustado com o tune */
    var slideF = { col: 1, t0: 1, t1: 1, b0: 1, b1: 1, e: 1, f: 1, d: 1, r: 1 };
    function groupKey(i) {
      if (i === 0) return 'e';
      if (i === 3) return 'f';
      if (i === 1) return 'd';
      if (i === DRE) return 'r';
      if (layout === 'cols' || layout === 'colsShort') return 'col';
      return (i === 10 || i === 2) ? 't0' : (i === 9 || i === 4) ? 't1' : (i === 8 || i === 5) ? 'b0' : 'b1';
    }
    function buildWorld() {
      var w = { cards: [], conns: {}, edges: {}, extra: [], extraCard: [], ring: null, ringCards: null, layout: layout };
      var cx = W / 2, cy = H / 2;
      function card(i, x, y, cw, ch, side) {
        var c = { i: i, label: i === DRE ? DRE_LABEL : AREAS[i], index: i === DRE ? 'R$' : (i + 1 < 10 ? '0' : '') + (i + 1),
          x: x - cw / 2, y: y - ch / 2, w: cw, h: ch, cx: x, cy: y, side: side, dre: i === DRE };
        w.cards.push(c); return c;
      }
      var csw, ch, sw, sh, gi, gs, slab, spine = {};
      var land = layout === 'cols' || layout === 'colsShort';
      if (land && W >= 1000) {
        csw = U.clamp(W * 0.15, 224, 270); ch = U.clamp(H * 0.072, 52, 70);
        sw = U.clamp(W * 0.25, 190, 400); sh = U.clamp(H * 0.14, 80, 150);
        gi = U.clamp(H * 0.03, 16, 30); gs = U.clamp(H * 0.018, 10, 18);
      } else if (land) {
        /* paisagem estreita: espinha compacta, para a câmera de repouso mostrar os
           rótulos com 12 px ou mais e as colunas ficarem fora da janela inicial */
        csw = 224; ch = 52;
        sw = U.clamp(W * 0.28, 180, 260); sh = U.clamp(H * 0.11, 60, 90);
        gi = 12; gs = 7;
      } else {
        csw = U.clamp(W * 0.62, 224, 320); ch = U.clamp(H * 0.065, 52, 60);
        /* 'tiny': núcleo um pouco mais estreito que a espinha — a câmera de repouso
           fica mais perto e 01/DRE podem ficar mais perto dele sem entrar na janela */
        sw = layout === 'tiny' ? Math.round(csw * 0.82) : csw;
        sh = layout === 'portrait' ? U.clamp(H * 0.12, 80, 140) : 64;
        gi = U.clamp(H * 0.022, 12, 22);
        gs = U.clamp(H * 0.014, 8, 14);
      }
      /* conjunto de repouso: espinha inteira; 'short'/'colsShort' = 02, núcleo e DRE;
         'tiny' = só o núcleo. Os de fora ficam afastados o bastante para estarem
         inteiros fora da janela inicial (8 px de folga, em unidades do mundo). */
      var iw = Math.max(sw, csw);
      var w0r = start.w * W, h0r = start.h * H;
      var restH = layout === 'tiny' ? sh : (layout === 'short' || layout === 'colsShort') ? 2 * ch + 2 * gi + sh : 4 * ch + 2 * gi + 2 * gs + sh;
      var restW = layout === 'tiny' ? sw : iw;
      var zr = U.clamp(Math.min((w0r - 24) / restW, (h0r - 24) / restH), 0.5, 1.8);
      var vh = (h0r / 2) / zr;
      if (layout === 'tiny') gi = Math.max(gi, vh + 8 - sh / 2);
      if (layout === 'short' || layout === 'colsShort' || layout === 'tiny') gs = Math.max(gs, vh + 8 - sh / 2 - gi - ch);
      slab = w.slab = { x: cx - sw / 2, y: cy - sh / 2, w: sw, h: sh };
      var yD = slab.y - gi - ch / 2, yR = slab.y + sh + gi + ch / 2;
      if (layout === 'tiny') { yD += tune.d; yR += tune.r; }
      var yE = yD - ch - gs, yF = yR + ch + gs;
      if (layout !== 'portrait' && layout !== 'cols') { yE += tune.e; yF += tune.f; }
      spine.E = card(0, cx, yE, csw, ch, 'spine');
      spine.D = card(1, cx, yD, csw, ch, 'spine');
      spine.R = card(DRE, cx, yR, csw, ch, 'spine');
      spine.F = card(3, cx, yF, csw, ch, 'spine');
      /* conjunto visível em repouso (a câmera o enquadra inteiro) */
      w.inner = layout === 'tiny' ? { x: slab.x, y: slab.y, w: sw, h: sh }
        : (layout === 'short' || layout === 'colsShort')
        ? { x: cx - iw / 2, y: spine.D.y, w: iw, h: spine.R.y + ch - spine.D.y }
        : { x: cx - iw / 2, y: spine.E.y, w: iw, h: spine.F.y + ch - spine.E.y };

      var outer = [];
      var conns = w.conns, edges = w.edges;
      conns[1] = poly([{ x: cx, y: spine.D.y + ch }, { x: cx, y: slab.y }]);
      conns[DRE] = poly([{ x: cx, y: spine.R.y }, { x: cx, y: slab.y + sh }]);
      if (land) {
        var pad = W >= 1000 ? Math.max(14, W * 0.035) : Math.max(10, W * 0.02), gapC = Math.max(40, W * 0.045);
        /* em repouso as colunas ficam inteiras fora da janela inicial (10 px de folga) */
        var zb = U.clamp(Math.min((start.w * W - 24) / iw, (start.h * H - 24) / w.inner.h), 0.5, 1.8);
        var innerMax = W / 2 - (start.w * W / 2 + 10) / zb;
        var cwo = Math.min((W - sw - 2 * gapC) / 2 - pad, Math.max(W * 0.15, 190), 250, opts.still ? Infinity : innerMax - pad);
        var xl = pad + cwo / 2 + tune.col, xr = W - pad - cwo / 2 - tune.col;
        w.colLimit = { outer: pad + tune.col, inner: innerMax - (pad + cwo + tune.col) };
        /* em telas estreitas as fileiras de cima e de baixo ficam mais para dentro: quando a
           borda lateral da janela passa por elas, já estão dentro da altura da janela */
        var rows = W >= 1000 ? [0.14, 0.38, 0.62, 0.86] : [0.22, 0.407, 0.593, 0.78];
        [10, 9, 8, 7].forEach(function (i, k) { outer.push(card(i, xl, H * rows[k], cwo, ch, 'left')); });
        [2, 4, 5, 6].forEach(function (i, k) { outer.push(card(i, xr, H * rows[k], cwo, ch, 'right')); });
        w.ring = poly([{ x: xl, y: H * rows[0] }, { x: xr, y: H * rows[0] }, { x: xr, y: H * rows[3] }, { x: xl, y: H * rows[3] }, { x: xl, y: H * rows[0] }]);
        w.ringCards = [10, 2, 6, 7, 10];
        var lx = cx - csw / 2 - 14, rx = cx + csw / 2 + 14;
        conns[0] = poly([{ x: spine.E.x, y: yE }, { x: lx, y: yE }, { x: lx, y: slab.y }]);
        conns[3] = poly([{ x: spine.F.x + csw, y: yF }, { x: rx, y: yF }, { x: rx, y: slab.y + sh }]);
        ['left', 'right'].forEach(function (side) {
          var g = outer.filter(function (c) { return c.side === side; });
          g.forEach(function (c, k) {
            var py = slab.y + sh * (k + 1) / (g.length + 1);
            var sx = side === 'left' ? c.x + c.w : c.x;
            var px = side === 'left' ? slab.x : slab.x + slab.w;
            var mx = (sx + px) / 2 + (k - 1.5) * 12 * (side === 'left' ? 1 : -1);
            conns[c.i] = poly([{ x: sx, y: c.cy }, { x: mx, y: c.cy }, { x: mx, y: py }, { x: px, y: py }]);
            edges[c.i] = side === 'left' ? poly([{ x: 0, y: c.cy }, { x: c.x, y: c.cy }]) : poly([{ x: W, y: c.cy }, { x: c.x + c.w, y: c.cy }]);
            if (k === 0) { w.extra.push(poly([{ x: c.cx, y: 0 }, { x: c.cx, y: c.y }])); w.extraCard.push(c.i); }
            if (k === g.length - 1) { w.extra.push(poly([{ x: c.cx, y: H }, { x: c.cx, y: c.y + c.h }])); w.extraCard.push(c.i); }
          });
        });
        edges[0] = poly([{ x: cx + csw * 0.25, y: 0 }, { x: cx + csw * 0.25, y: spine.E.y }]);
        edges[3] = poly([{ x: cx - csw * 0.25, y: H }, { x: cx - csw * 0.25, y: spine.F.y + ch }]);
      } else {
        var padP = U.clamp(W * 0.04, 12, 20);
        var cwp = (W - 3 * padP) / 2;
        var xL = padP + cwp / 2, xR = W - padP - cwp / 2;
        var tight = layout !== 'portrait';
        var chp = ch, sp = tight ? 10 : 40, rg = tight ? 12 : 18;
        var top0 = tight ? chp / 2 + 8 : Math.max(chp / 2 + 10, H * 0.065), top1 = Math.min(spine.E.y - sp - chp / 2, top0 + chp + rg);
        var bot1 = tight ? H - chp / 2 - 8 : Math.min(H - chp / 2 - 10, H * 0.935), bot0 = Math.max(spine.F.y + ch + sp + chp / 2, bot1 - chp - rg);
        top0 += tune.t0; top1 += tune.t1; bot0 += tune.b0; bot1 += tune.b1;
        outer.push(card(10, xL, top0, cwp, chp, 'top'), card(2, xR, top0, cwp, chp, 'top'));
        outer.push(card(9, xL, top1, cwp, chp, 'top'), card(4, xR, top1, cwp, chp, 'top'));
        outer.push(card(8, xL, bot0, cwp, chp, 'bottom'), card(5, xR, bot0, cwp, chp, 'bottom'));
        outer.push(card(7, xL, bot1, cwp, chp, 'bottom'), card(6, xR, bot1, cwp, chp, 'bottom'));
        conns[0] = poly([{ x: cx - csw * 0.3, y: spine.E.y + ch }, { x: cx - csw * 0.3, y: slab.y }]);
        conns[3] = poly([{ x: cx + csw * 0.3, y: spine.F.y }, { x: cx + csw * 0.3, y: slab.y + sh }]);
        outer.forEach(function (c) {
          var row = (c.cy < cy) ? (c.i === 9 || c.i === 4 ? 1 : 0) : (c.i === 8 || c.i === 5 ? 0 : 1);
          var off = (c.cx < cx ? -1 : 1) * (row === 0 ? 0.34 : 0.22) * c.w;
          var x = c.cx + off;
          var sxIn = U.clamp(x, slab.x + 10, slab.x + slab.w - 10);
          if (c.side === 'top') conns[c.i] = poly([{ x: x, y: c.y + c.h }, { x: x, y: slab.y - 10 - row * 8 }, { x: sxIn, y: slab.y - 10 - row * 8 }, { x: sxIn, y: slab.y }]);
          else conns[c.i] = poly([{ x: x, y: c.y }, { x: x, y: slab.y + sh + 10 + row * 8 }, { x: sxIn, y: slab.y + sh + 10 + row * 8 }, { x: sxIn, y: slab.y + sh }]);
          edges[c.i] = c.cx < cx ? poly([{ x: 0, y: c.cy }, { x: c.x, y: c.cy }]) : poly([{ x: W, y: c.cy }, { x: c.x + c.w, y: c.cy }]);
        });
        edges[1] = null; edges[DRE] = null;
        edges[0] = poly([{ x: cx + csw * 0.2, y: spine.D.y }, { x: cx + csw * 0.2, y: spine.E.y + ch }]);
        edges[3] = poly([{ x: cx - csw * 0.2, y: spine.R.y + ch }, { x: cx - csw * 0.2, y: spine.F.y }]);
      }
      typeWorld(w);
      /* Entrada: as áreas de fora chegam deslizando ao longo das próprias linhas até o
         lugar (deslocamento para fora que vai a 0 com a expansão). Somado ao avanço da
         borda da janela, o recorte de entrada dura pouco; em tela cheia a composição é
         exatamente a do mundo. */
      w.cards.forEach(function (c) {
        var d;
        c.slide = { x: 0, y: 0 };
        if (c.side === 'left' || c.side === 'right') { d = c.w * 1.0; c.slide.x = c.side === 'left' ? -d : d; }
        else if (c.side === 'top' || c.side === 'bottom') { d = c.h * 1.8; c.slide.y = c.side === 'top' ? -d : d; }
        else if (layout !== 'portrait' && layout !== 'cols' && (c.i === 0 || c.i === 3)) { d = c.h * 1.2; c.slide.y = c.i === 0 ? -d : d; }
        else if (layout === 'tiny' && (c.i === 1 || c.i === DRE)) { d = c.h * 1.2; c.slide.y = c.i === 1 ? -d : d; }
        var fct = slideF[groupKey(c.i)]; if (fct === undefined) fct = 1;
        c.slide.x *= fct; c.slide.y *= fct;
      });

      /* portas no núcleo */
      w.ports = [];
      Object.keys(conns).forEach(function (k) {
        var pl = conns[k]; var end = pl.pts[pl.pts.length - 1];
        w.ports.push({ i: +k, x: end.x, y: end.y });
      });
      w.byIndex = {};
      w.cards.forEach(function (c) { w.byIndex[c.i] = c; });
      return w;
    }

    function resize() {
      var cw = canvas.clientWidth, chh = canvas.clientHeight;
      if (!cw || !chh) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var wasPortrait = portrait, changed = Math.abs(cw - W) > 0.5 || Math.abs(chh - H) > 0.5;
      W = cw; H = chh;
      portrait = W / H < 0.95;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      if (typeof opts.startRect === 'function') start = opts.startRect() || start;
      if (!sim || wasPortrait !== portrait) sim = initSim();
      if (!labelW10) measureLabels();
      var w0 = start.w * W, h0 = start.h * H;
      /* câmera em repouso: enquadra o conjunto de repouso inteiro dentro da janela
         inicial, com 12 px de folga em cada lado */
      var fit = function () {
        return U.clamp(Math.min((w0 - 24) / world.inner.w, (h0 - 24) / world.inner.h), 0.5, 1.8);
      };
      /* composição base por orientação; se o conjunto de repouso só coubesse com
         rótulos abaixo de 12 px, ela se adapta (menos cartões em repouso) */
      var chain = portrait ? ['portrait', 'short', 'tiny'] : ['cols', 'colsShort'];
      for (var li = 0; li < chain.length; li++) {
        layout = chain[li];
        Object.keys(tune).forEach(function (k) { tune[k] = 0; slideF[k] = 1; });
        world = buildWorld();
        if (fit() * world.fs >= 12) break;
      }
      z0 = fit();
      zg0 = 1 + (z0 - 1) * 0.5;
      if (!opts.still) alignEntries();
      return true;
    }

    /* Entradas pelos lados da janela: em repouso nenhum cartão está cortado; nos
       pontos de parada da roda (a cada 50 px de entrada, p = k/14) nenhum cartão
       aparece só como um filete. Cada grupo de cartões que entra junto (coluna ou
       fileira) é deslocado alguns px, se preciso, para a sua entrada cair entre
       duas paradas. A composição continua a mesma durante toda a expansão. */
    var THIN = 24;
    function cardScreen(c, cam, p) {
      var o = slideAt(c, p);
      var x = cam.ox + (c.x + o.x) * cam.z, y = cam.oy + (c.y + o.y) * cam.z, w = c.w * cam.z, h = c.h * cam.z, R = cam.R;
      var vw = Math.max(0, Math.min(x + w, R.x + R.w) - Math.max(x, R.x));
      var vh = Math.max(0, Math.min(y + h, R.y + R.h) - Math.max(y, R.y));
      return { vw: vw, vh: vh, full: vw >= w - 0.5 && vh >= h - 0.5, none: vw <= 0 || vh <= 0 };
    }
    function worldOk(ids) {
      var cs = world.cards, i, j, sl = world.slab;
      for (i = 0; i < cs.length; i++) {
        var a = cs[i];
        if (a.x < 6 || a.y < 6 || a.x + a.w > W - 6 || a.y + a.h > H - 6) return false;
        /* nenhum cartão encosta no núcleo (IRON AI) */
        if (a.x < sl.x + sl.w + 6 && sl.x < a.x + a.w + 6 && a.y < sl.y + sl.h + 6 && sl.y < a.y + a.h + 6) return false;
        for (j = i + 1; j < cs.length; j++) {
          var b = cs[j];
          if (a.x < b.x + b.w + 6 && b.x < a.x + a.w + 6 && a.y < b.y + b.h + 6 && b.y < a.y + a.h + 6) return false;
        }
      }
      if (world.colLimit && (world.colLimit.inner < 0)) return false;
      /* repouso: inteiro dentro ou inteiro fora (com folga) */
      var cam0 = camera(0);
      for (i = 0; i < cs.length; i++) {
        if (ids && ids.indexOf(cs[i].i) < 0) continue;
        var v = cardScreen(cs[i], cam0, 0);
        if (!v.full && !v.none) return false;
      }
      return true;
    }
    /* menor recorte nas paradas: w7 = a cada evento da roda (k/7), w14 = meio evento */
    function thinScore(ids) {
      var w7 = Infinity, w14 = Infinity;
      for (var k = 1; k < 14; k++) {
        var cam = camera(k / 14);
        for (var i = 0; i < world.cards.length; i++) {
          var c = world.cards[i];
          if (ids.indexOf(c.i) < 0) continue;
          var v = cardScreen(c, cam, k / 14);
          if (v.none || v.full) continue;
          var m = Math.min(v.vw, v.vh);
          /* nos eventos da roda, um cartão cortado em cima ou embaixo mostra o rótulo
             inteiro (só a margem interna pode ficar de fora): vh >= altura - 8 px */
          if (k % 2 === 0) {
            var hs = c.h * cam.z;
            w7 = Math.min(w7, Math.min(v.vw, v.vh >= hs - 8 ? THIN + 1 : v.vh * THIN / Math.max(1, hs - 8)));
          } else w14 = Math.min(w14, m);
        }
      }
      return { w7: w7, w14: w14, worst: Math.min(w7, w14) };
    }
    function slideIsTuned() { return Object.keys(slideF).some(function (k) { return slideF[k] !== 1; }); }
    /* durante a entrada (com o deslizamento) os cartões visíveis não se encostam */
    function motionOk(ids) {
      var cs = world.cards;
      for (var q = 1; q < 28; q++) {
        var pq = q / 28, cam = camera(pq), R = cam.R, bx = [];
        for (var i = 0; i < cs.length; i++) {
          var c = cs[i], o = slideAt(c, pq);
          var x = cam.ox + (c.x + o.x) * cam.z, y = cam.oy + (c.y + o.y) * cam.z, w = c.w * cam.z, h = c.h * cam.z;
          var vis = x < R.x + R.w && x + w > R.x && y < R.y + R.h && y + h > R.y;
          bx.push({ i: c.i, x: x, y: y, w: w, h: h, vis: vis, mine: ids.indexOf(c.i) >= 0 });
        }
        for (i = 0; i < bx.length; i++) for (var j = i + 1; j < bx.length; j++) {
          var a = bx[i], b = bx[j];
          if (!(a.mine || b.mine) || !a.vis || !b.vis) continue;
          if (a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4) return false;
        }
      }
      return true;
    }
    function alignEntries() {
      var land = layout === 'cols' || layout === 'colsShort';
      var groups = land ? [['col', [10, 9, 8, 7, 2, 4, 5, 6]]]
        : [['t0', [10, 2]], ['t1', [9, 4]], ['b0', [8, 5]], ['b1', [7, 6]]];
      /* espinha primeiro: as fileiras de dentro dependem da posição dela */
      if (layout === 'colsShort') groups.push(['e', [0]], ['f', [3]]);
      if (layout === 'short' || layout === 'tiny') groups.unshift(['e', [0]], ['f', [3]]);
      if (layout === 'tiny') groups.unshift(['d', [1]], ['r', [DRE]]);
      Object.keys(tune).forEach(function (k) { tune[k] = 0; slideF[k] = 1; });
      world = buildWorld();
      var FACT = [1, 0.7, 1.3, 0.45, 1.6, 0.2, 2, 2.6, 3.2];
      /* duas passadas: na 2ª cada grupo é revisto com os vizinhos já no lugar */
      groups.concat(groups).forEach(function (g) {
        var key = g[0], ids = g[1], best = null;
        /* 1º só a posição (deslizamento padrão); se ainda sobrar filete num evento
           da roda, tenta também outros deslizamentos */
        for (var fi = 0; fi < FACT.length; fi++) {
          if (fi > 0 && best && best.score >= (THIN + 1) * 1000 + THIN + 1) break;
          if (fi > 0 && best && best.score >= (THIN + 1) * 1000 && fi > 2) break;
          slideF[key] = FACT[fi];
          for (var n = 0; n <= 40; n++) {
            var d = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 3;
            tune[key] = d;
            world = buildWorld();
            if (!worldOk(ids)) continue;
            var sc = thinScore(ids);
            /* eventos da roda primeiro, depois os meios-eventos; sem filete basta o menor deslocamento */
            var score = Math.min(sc.w7, THIN + 1) * 1000 + Math.min(sc.w14, THIN + 1);
            if (best && score <= best.score + 0.5) continue;
            if (slideIsTuned() && !motionOk(ids)) continue;
            best = { d: d, f: FACT[fi], score: score };
          }
        }
        tune[key] = best ? best.d : 0;
        slideF[key] = best ? best.f : 1;
        world = buildWorld();
      });
    }

    /* janela: cresce nas duas dimensões juntas desde o 1º evento */
    function rectAt(p) {
      if (staticRect) return staticRect;
      if (p >= 0.9995) return { x: 0, y: 0, w: W, h: H };
      var e = U.clamp(p, 0, 1);
      var w = W * U.lerp(start.w, 1, e);
      var h = H * U.lerp(start.h, 1, e);
      var cy = H * U.lerp(start.cy, 0.5, e);
      var cx = W * U.lerp(start.cx === undefined ? 0.5 : start.cx, 0.5, e);
      return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    }
    function camera(p) {
      var R = rectAt(p);
      var e = staticRect ? 1 : U.clamp(p, 0, 1);
      var z = p >= 0.9995 || staticRect ? 1 : U.lerp(z0, 1, e);
      var zg = p >= 0.9995 || staticRect ? 1 : U.lerp(zg0, 1, e);
      var ccx = R.x + R.w / 2, ccy = R.y + R.h / 2;
      return { R: R, z: z, zg: zg, ox: ccx - (W / 2) * z, oy: ccy - (H / 2) * z, ogx: ccx - (W / 2) * zg, ogy: ccy - (H / 2) * zg };
    }

    /* ---------- geometria do quadro: deslizamento de entrada aplicado ---------- */
    function slideAt(c, p) { var f = 1 - U.clamp(p, 0, 1); return { x: c.slide.x * f, y: c.slide.y * f }; }
    var fg = null;
    function frameGeometry(p) {
      var off = {};
      world.cards.forEach(function (c) { off[c.i] = slideAt(c, p); });
      /* desloca a ponta da linha junto com o cartão e mantém a linha ortogonal: a
         componente que o primeiro segmento não absorve passa ao ponto seguinte (um
         segmento horizontal leva o deslocamento vertical adiante, e vice-versa) —
         nunca surge um traço inclinado */
      var shift = function (pl, which, o) {
        if (!pl || !o || (o.x === 0 && o.y === 0)) return pl;
        var src = pl.pts, n = src.length;
        var pts = src.map(function (q) { return { x: q.x, y: q.y }; });
        if (which === 'all') { pts.forEach(function (q) { q.x += o.x; q.y += o.y; }); return poly(pts); }
        var dir = which === 'first' ? 1 : -1, k = which === 'first' ? 0 : n - 1;
        var cx = o.x, cy = o.y;
        pts[k].x += cx; pts[k].y += cy;
        for (var j = k + dir; j >= 0 && j < n; j += dir) {
          var a = src[j - dir], b = src[j];
          if (Math.abs(a.y - b.y) < 0.01) cx = 0;      /* horizontal: absorve o x, leva o y */
          else if (Math.abs(a.x - b.x) < 0.01) cy = 0; /* vertical: absorve o y, leva o x */
          if (cx === 0 && cy === 0) break;
          pts[j].x += cx; pts[j].y += cy;
        }
        return poly(pts);
      };
      var g = { off: off, conns: {}, edges: {}, extra: [], ring: world.ring };
      Object.keys(world.conns).forEach(function (k) { g.conns[k] = shift(world.conns[k], 'first', off[k]); });
      Object.keys(world.edges).forEach(function (k) {
        var c = world.byIndex[k];
        g.edges[k] = shift(world.edges[k], c && (c.side === 'top' || c.side === 'bottom') ? 'all' : 'last', off[k]);
      });
      world.extra.forEach(function (pl, k) { g.extra.push(shift(pl, 'all', off[world.extraCard[k]])); });
      if (world.ring && world.ringCards) {
        g.ring = poly(world.ring.pts.map(function (q, k) { var o = off[world.ringCards[k]] || { x: 0, y: 0 }; return { x: q.x + o.x, y: q.y + o.y }; }));
      }
      return g;
    }

    /* ---------- simulação: chegadas e agentes ---------- */
    function step(t) {
      for (var i = 0; i < sim.packets.length; i++) {
        var p = sim.packets[i], cyc = 1 + p.gap, d = t * p.speed + p.phase;
        p.u = d % cyc;
        var n = Math.floor((d - 1) / cyc);
        if (p.n !== null && n > p.n && !p.edge) {
          if (p.dir === 1) { sim.flashes.push({ c: p.c, t0: t }); if (sim.flashes.length > 14) sim.flashes.shift(); }
          else sim.nodeFlash[p.c] = t;
        }
        p.n = n;
      }
      for (var a = 0; a < sim.agents.length; a++) {
        var ag = sim.agents[a];
        if (t - ag.t0 > ag.dur + ag.wait) {
          ag.trail.unshift({ gx: ag.gx, gy: ag.gy }); if (ag.trail.length > 4) ag.trail.pop();
          ag.fx = ag.gx; ag.fy = ag.gy;
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], pick = dirs[Math.floor(ag.rand() * 4)];
          var st = 1 + Math.floor(ag.rand() * 3);
          var nx = U.clamp(ag.gx + pick[0] * st, 0, sim.NX - 1), ny = U.clamp(ag.gy + pick[1] * st, 1, sim.NY - 1);
          if (nx === ag.gx && ny === ag.gy) { nx = U.clamp(ag.gx - pick[0] * st, 0, sim.NX - 1); ny = U.clamp(ag.gy - pick[1] * st, 1, sim.NY - 1); }
          ag.gx = nx; ag.gy = ny; ag.dur = 0.35 + 0.18 * st; ag.wait = 0.25 + ag.rand() * 0.7; ag.t0 = t;
        }
        var e = easeInOut(U.clamp((t - ag.t0) / ag.dur, 0, 1));
        ag.x = U.lerp(ag.fx, ag.gx, e); ag.y = U.lerp(ag.fy, ag.gy, e);
      }
    }

    function spacing(px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px.toFixed(2) + 'px'; }

    /* ---------- desenho ---------- */
    /* Cena de fundo (planta técnica, design-system "Grade de fundo"): hairlines em
       `line` sobre o paper do palco, de ponta a ponta, atrás do texto também.
       - a grade é a mesma do campo da mídia (passo 44 px do mundo, câmera lenta zg):
         as linhas do campo continuam além da janela e a grade amplia mais devagar
         que o painel (paralaxe);
       - linhas de entrada tracejadas cruzam a cena até as bordas da tela, na fileira
         (paisagem) ou na coluna (retrato) de cada área que entra pelos lados;
       - sem preenchimento, sem pontos e sem opacidade: tudo em pixel inteiro (sem
         tons de borda) e o painel cobre a cena ao crescer. */
    /* região da cena no progresso p: a tela inteira em repouso; ao longo da expansão
       as linhas se recolhem por comprimento, das bordas da tela para o painel, e a
       região fecha sobre a janela em p = SCENE_END (antes da tela cheia) */
    var SCENE_END = 0.82;
    function sceneRect(p, R) {
      var e = U.clamp(p / SCENE_END, 0, 1);
      if (e >= 1) return null;
      var x0 = Math.round(U.lerp(0, R.x, e)), y0 = Math.round(U.lerp(0, R.y, e));
      var x1 = Math.round(U.lerp(W, R.x + R.w, e)), y1 = Math.round(U.lerp(H, R.y + R.h, e));
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    function drawScene(cam, p) {
      if (staticRect) return;
      var R = cam.R, E = sceneRect(p, R);
      if (!E) return;
      var ex1 = E.x + E.w, ey1 = E.y + E.h;
      ctx.fillStyle = U.css(C.line);
      var step = 44 * cam.zg, gx = cam.ogx + (W / 2) * cam.zg, gy = cam.ogy + (H / 2) * cam.zg;
      var x, y;
      for (x = gx - Math.floor(gx / step) * step; x < W; x += step) { var xr = Math.round(x); if (xr >= E.x && xr < ex1) ctx.fillRect(xr, E.y, 1, E.h); }
      for (y = gy - Math.floor(gy / step) * step; y < H; y += step) { var yr = Math.round(y); if (yr >= E.y && yr < ey1) ctx.fillRect(E.x, yr, E.w, 1); }
      var DASH = 4, GAP = 6, P = DASH + GAP, seen = {};
      var land = layout === 'cols' || layout === 'colsShort';
      world.cards.forEach(function (c) {
        if (land && (c.side === 'left' || c.side === 'right')) {
          var yy = Math.round(cam.oy + c.cy * cam.z);
          if (seen['y' + yy + c.side]) return; seen['y' + yy + c.side] = 1;
          if (yy < E.y || yy >= ey1) return;
          var a, e = Math.round(c.side === 'left' ? R.x : R.x + R.w);
          if (c.side === 'left') { for (a = e - P; a + GAP >= E.x; a -= P) ctx.fillRect(a + GAP, yy, DASH, 1); }
          else { for (a = e; a + GAP + DASH <= ex1; a += P) ctx.fillRect(a + GAP, yy, DASH, 1); }
        } else if (!land && (c.side === 'top' || c.side === 'bottom')) {
          var xx = Math.round(cam.ox + c.cx * cam.z);
          if (seen['x' + xx + c.side]) return; seen['x' + xx + c.side] = 1;
          if (xx < E.x || xx >= ex1) return;
          var b2, e2 = Math.round(c.side === 'top' ? R.y : R.y + R.h);
          if (c.side === 'top') { for (b2 = e2 - P; b2 + GAP >= E.y; b2 -= P) ctx.fillRect(xx, b2 + GAP, 1, DASH); }
          else { for (b2 = e2; b2 + GAP + DASH <= ey1; b2 += P) ctx.fillRect(xx, b2 + GAP, 1, DASH); }
        }
      });
    }

    /* ---------- desenho alinhado ao pixel ----------
       Todos os retângulos e traços ortogonais da ilustração são desenhados em pixel
       de dispositivo inteiro (sem meia cobertura nas bordas), para que nenhum quadro
       tenha tons fora dos tokens nas caixas, linhas e no recorte da janela. Só o
       texto é desenhado na transformação do mundo (com a suavização normal da fonte). */
    var SN = { ox: 0, oy: 0, z: 1, dx: 0, dy: 0 };
    function devX(x) { return Math.round((SN.ox + (x + SN.dx) * SN.z) * dpr); }
    function devY(y) { return Math.round((SN.oy + (y + SN.dy) * SN.z) * dpr); }
    function lwDev(screenPx) { return Math.max(1, Math.round(screenPx * dpr)); }
    var RDW = null;   /* janela atual em px de dispositivo */
    /* nó (quadrado) só aparece inteiro dentro da janela: nunca cortado ao meio na borda */
    function nodeW(x, y, w, h) {
      var X0 = devX(x), X1 = devX(x + w), Y0 = devY(y), Y1 = devY(y + h);
      if (RDW && (X0 < RDW.x || Y0 < RDW.y || X1 > RDW.x + RDW.w || Y1 > RDW.y + RDW.h)) return;
      ctx.fillRect(X0, Y0, Math.max(1, X1 - X0), Math.max(1, Y1 - Y0));
    }
    function rectW(x, y, w, h) {
      var X0 = devX(x), X1 = devX(x + w), Y0 = devY(y), Y1 = devY(y + h);
      if (X1 <= X0) X1 = X0 + 1;
      if (Y1 <= Y0) Y1 = Y0 + 1;
      ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    }
    /* segmento ortogonal do mundo com espessura t (px de dispositivo) */
    function segW(ax, ay, bx, by, t, cap) {
      var h0 = Math.floor(t / 2), c = cap ? h0 : 0, X0, X1, Y0, Y1;
      if (Math.abs(ay - by) < 0.01) {
        X0 = devX(Math.min(ax, bx)); X1 = devX(Math.max(ax, bx)); Y0 = devY(ay);
        ctx.fillRect(X0 - c, Y0 - h0, Math.max(1, X1 - X0 + 2 * c), t);
      } else if (Math.abs(ax - bx) < 0.01) {
        Y0 = devY(Math.min(ay, by)); Y1 = devY(Math.max(ay, by)); X0 = devX(ax);
        ctx.fillRect(X0 - h0, Y0 - c, t, Math.max(1, Y1 - Y0 + 2 * c));
      } else {
        /* diagonal: em degraus de pixel, sem suavização */
        var n = Math.max(Math.abs(devX(bx) - devX(ax)), Math.abs(devY(by) - devY(ay)), 1);
        for (var k = 0; k <= n; k++) {
          var q = k / n;
          ctx.fillRect(devX(ax + (bx - ax) * q) - h0, devY(ay + (by - ay) * q) - h0, t, t);
        }
      }
    }
    function polyW(pl, t) {
      for (var i = 1; i < pl.pts.length; i++) segW(pl.pts[i - 1].x, pl.pts[i - 1].y, pl.pts[i].x, pl.pts[i].y, t, true);
    }
    function partW(pl, u0, u1, t, cap) {
      u0 = U.clamp(u0, 0, pl.len); u1 = U.clamp(u1, 0, pl.len);
      if (u1 - u0 < 0.01) return;
      for (var i = 1; i < pl.pts.length; i++) {
        var s0 = Math.max(u0, pl.cum[i - 1]), s1 = Math.min(u1, pl.cum[i]);
        if (s1 - s0 < 0.01) continue;
        var a = pointAt(pl, s0), b = pointAt(pl, s1);
        segW(a.x, a.y, b.x, b.y, t, cap);
      }
    }
    /* tracejado ao longo da polilinha (unidades do mundo), fase em unidades do mundo */
    function dashW(pl, dash, gap, phase, t) {
      var per = dash + gap, u = (((phase % per) + per) % per) - per;
      for (; u < pl.len; u += per) partW(pl, u, u + dash, t, false);
    }
    /* transformação do mundo, só para texto */
    function worldText() { ctx.setTransform(dpr * SN.z, 0, 0, dpr * SN.z, dpr * (SN.ox + SN.dx * SN.z), dpr * (SN.oy + SN.dy * SN.z)); }
    function deviceSpace() { ctx.setTransform(1, 0, 0, 1, 0, 0); }

    function drawField(cam, RD) {
      var R = cam.R;
      ctx.fillStyle = U.css(C.accent);
      ctx.fillRect(RD.x, RD.y, RD.w, RD.h);
      /* grade do campo: passo do mundo 44 px, câmera mais lenta (zg); as mesmas
         colunas e linhas de pixel da cena de fundo (continuam além da janela) */
      var step = 44 * cam.zg, gx = cam.ogx + (W / 2) * cam.zg, gy = cam.ogy + (H / 2) * cam.zg;
      var d = Math.max(1, Math.round(dpr));
      ctx.fillStyle = U.css(C.accentText);
      /* uma linha a menos de 3 px da borda da janela não é desenhada (não vira um
         filete colado à borda) */
      var gap3 = 3 * dpr, X;
      for (var x = gx - Math.ceil((gx - R.x) / step) * step; x <= R.x + R.w; x += step) {
        X = Math.round(x) * dpr; if (X - RD.x < gap3 || RD.x + RD.w - X - d < gap3) continue;
        ctx.fillRect(X, RD.y, d, RD.h);
      }
      for (var y = gy - Math.ceil((gy - R.y) / step) * step; y <= R.y + R.h; y += step) {
        X = Math.round(y) * dpr; if (X - RD.y < gap3 || RD.y + RD.h - X - d < gap3) continue;
        ctx.fillRect(RD.x, X, RD.w, d);
      }
    }

    function drawRing(t, k) {
      if (!fg.ring) return;
      ctx.fillStyle = U.css(C.band);
      dashW(fg.ring, 3, 7, t * 16, lwDev(1.5));
      ctx.fillStyle = U.css(C.acid);
      for (var r = 0; r < sim.ring.length; r++) {
        var pt = pointAt(fg.ring, ((t * 0.018 + sim.ring[r]) % 1) * fg.ring.len);
        nodeW(pt.x - 3, pt.y - 3, 6, 6);
      }
    }

    function drawLines(k) {
      var tl = lwDev(Math.max(1, 2 * k));
      ctx.fillStyle = U.css(C.band);
      Object.keys(fg.conns).forEach(function (i) { polyW(fg.conns[i], tl); });
      Object.keys(fg.edges).forEach(function (i) { if (fg.edges[i]) dashW(fg.edges[i], 2, 5, 0, tl); });
      fg.extra.forEach(function (pl) { dashW(pl, 2, 5, 0, tl); });
    }

    function drawPackets(k) {
      var tp = lwDev(3 * k);
      for (var i = 0; i < sim.packets.length; i++) {
        var p = sim.packets[i];
        if (p.u > 1) continue;
        var pl = p.edge ? fg.edges[p.c] : fg.conns[p.c];
        if (!pl) continue;
        var len = pl.len, u = (p.dir === 1 ? p.u : 1 - p.u) * len;
        var col = p.kind === 'paper' ? C.surface : C.acid;
        ctx.fillStyle = U.css(col);
        if (p.dir === 1) partW(pl, u - 22, u, tp, true); else partW(pl, u, u + 22, tp, true);
        var pt = pointAt(pl, u);
        nodeW(pt.x - 5, pt.y - 5, 10, 10);
      }
    }

    function drawExtraPackets(t) {
      ctx.fillStyle = U.css(C.acid);
      for (var i = 0; i < fg.extra.length && i < sim.extra.length; i++) {
        var q = sim.extra[i], u = (t * q.speed + q.phase) % (1 + q.gap);
        if (u > 1) continue;
        var pt = pointAt(fg.extra[i], u * fg.extra[i].len);
        nodeW(pt.x - 5, pt.y - 5, 10, 10);
      }
    }

    function drawSlab(t) {
      var sl = world.slab, NX = sim.NX, NY = sim.NY;
      var P = Math.min(sl.w / (NX + 1), sl.h / (NY + 1));
      var x0 = sl.x + (sl.w - (NX - 1) * P) / 2, y0 = sl.y + (sl.h - (NY - 1) * P) / 2;
      ctx.fillStyle = U.css(C.acid);
      rectW(sl.x, sl.y, sl.w, sl.h);
      /* wordmark do núcleo */
      var fsW = U.clamp(P * 0.95, 11, 24), lx = x0 - P * 0.15, ly = y0 + fsW * 0.36;
      worldText();
      ctx.fillStyle = U.css(C.text);
      ctx.font = '500 ' + fsW.toFixed(2) + 'px ' + SANS; spacing(fsW * 0.1);
      ctx.fillText('IRON', lx, ly);
      var w1 = ctx.measureText('IRON').width;
      ctx.font = '800 ' + fsW.toFixed(2) + 'px ' + SANS;
      ctx.fillText('AI', lx + w1 + fsW * 0.3, ly);
      var w2 = ctx.measureText('AI').width;
      spacing(0);
      deviceSpace();
      var labelEnd = lx + w1 + w2 + fsW * 0.3 + P * 0.6;
      var dot = Math.max(2.5, P * 0.16);
      for (var j = 0; j < NY; j++) {
        var y = y0 + j * P;
        for (var i = 0; i < NX; i++) {
          var x = x0 + i * P;
          if (x < labelEnd && y < ly + fsW * 0.3 + dot) continue;
          var I = 0, d, q;
          for (q = 0; q < sim.agents.length; q++) {
            d = Math.abs(sim.agents[q].x - i) + Math.abs(sim.agents[q].y - j);
            if (d < 2.6) I = Math.max(I, 1 - d / 2.6);
          }
          for (q = 0; q < sim.flashes.length; q++) {
            var age = t - sim.flashes[q].t0;
            if (age < 0 || age > 1.3) continue;
            var port = null;
            for (var pi = 0; pi < world.ports.length; pi++) if (world.ports[pi].i === sim.flashes[q].c) { port = world.ports[pi]; break; }
            if (!port) continue;
            d = (Math.abs(port.x - x) + Math.abs(port.y - y)) / P;
            var ring = 1 - Math.abs(d - (0.5 + age * 5.2)) / 1.1;
            if (ring > 0) I = Math.max(I, ring * (1 - age / 1.3));
          }
          var sz = dot * (1 + (I > 0.5 ? 1 : 0));
          ctx.fillStyle = U.css(I > 0.5 ? C.accent : C.accentText);
          rectW(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
      var as = Math.max(7, P * 0.5);
      ctx.fillStyle = U.css(C.text);
      var ta = lwDev(Math.max(1, P * 0.07) * SN.z);
      for (var a = 0; a < sim.agents.length; a++) {
        var ag = sim.agents[a];
        var axp = x0 + ag.x * P, ayp = y0 + ag.y * P;
        var pts = [{ x: axp, y: ayp }, { x: x0 + ag.fx * P, y: y0 + ag.fy * P }];
        for (var tr = 0; tr < ag.trail.length; tr++) pts.push({ x: x0 + ag.trail[tr].gx * P, y: y0 + ag.trail[tr].gy * P });
        for (var pp = 1; pp < pts.length; pp++) segW(pts[pp - 1].x, pts[pp - 1].y, pts[pp].x, pts[pp].y, ta, true);
        nodeW(axp - as / 2, ayp - as / 2, as, as);
      }
      world.ports.forEach(function (pt) { nodeW(pt.x - 4.5, pt.y - 4.5, 9, 9); });
    }

    /* O cartão é sempre desenhado inteiro — caixa, índice, rótulo e status —, e a
       janela o recorta como uma câmera. Nenhum cartão vazio, nenhum a meia
       opacidade. Os cartões da esquerda são espelhados (índice e rótulo do lado
       do centro): o lado que a janela descobre primeiro já traz o rótulo. */
    function drawCard(c, t) {
      var on = t - sim.nodeFlash[c.i] < 1.1;
      var mirror = c.side === 'left';
      ctx.fillStyle = U.css(c.dre || on ? C.acid : C.surface);
      rectW(c.x, c.y, c.w, c.h);
      if (c.dre) {
        var X0 = devX(c.x), X1 = devX(c.x + c.w), Y0 = devY(c.y), Y1 = devY(c.y + c.h), tb = lwDev(2.5 * SN.z);
        ctx.fillStyle = U.css(C.text);
        ctx.fillRect(X0, Y0, X1 - X0, tb); ctx.fillRect(X0, Y1 - tb, X1 - X0, tb);
        ctx.fillRect(X0, Y0, tb, Y1 - Y0); ctx.fillRect(X1 - tb, Y0, tb, Y1 - Y0);
      }
      ctx.fillStyle = U.css(on ? C.accent : C.line);
      var sx = mirror ? c.x + c.padX * 0.8 : c.x + c.w - c.status - c.padX * 0.8;
      rectW(sx, c.y + c.padX * 0.8, c.status, c.status);
      var midY = c.y + c.h / 2;
      worldText();
      ctx.font = '500 ' + c.fsIdx.toFixed(2) + 'px ' + MONO; spacing(0);
      ctx.fillStyle = U.css(C.accentText);
      ctx.textAlign = mirror ? 'right' : 'left';
      ctx.fillText(c.index, mirror ? c.x + c.w - c.padX : c.x + c.padX, midY + c.fsIdx * 0.36);
      var fs = c.fs, lh = fs * 1.3;
      ctx.font = '600 ' + fs.toFixed(2) + 'px ' + MONO; spacing(fs * 0.06);
      ctx.fillStyle = U.css(C.text);
      var y0 = midY + fs * 0.36 - (c.label.length - 1) * lh / 2;
      var lx = mirror ? c.x + c.w - c.padX - c.idxCol : c.x + c.padX + c.idxCol;
      for (var i = 0; i < c.label.length; i++) ctx.fillText(c.label[i], lx, y0 + i * lh);
      spacing(0);
      ctx.textAlign = 'left';
      deviceSpace();
    }

    function render(t, p) {
      if (!sim || !W || !world) return;
      step(t);
      var cam = camera(p);
      var R = cam.R;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(cam, staticRect ? 1 : p);
      deviceSpace();
      /* janela em pixel inteiro: o recorte não deixa meia cobertura na borda */
      var RD = { x: Math.round(R.x * dpr), y: Math.round(R.y * dpr) };
      RD.w = Math.round((R.x + R.w) * dpr) - RD.x; RD.h = Math.round((R.y + R.h) * dpr) - RD.y;
      ctx.beginPath(); ctx.rect(RD.x, RD.y, RD.w, RD.h); ctx.clip();
      RDW = RD;
      ctx.textBaseline = 'alphabetic';
      drawField(cam, RD);
      SN.ox = cam.ox; SN.oy = cam.oy; SN.z = cam.z; SN.dx = 0; SN.dy = 0;
      fg = frameGeometry(staticRect ? 1 : p);
      drawRing(t, cam.z);
      drawLines(cam.z);
      drawPackets(cam.z);
      drawExtraPackets(t);
      drawSlab(t);
      for (var i = 0; i < world.cards.length; i++) {
        var c = world.cards[i], o = fg.off[c.i];
        SN.dx = o.x; SN.dy = o.y;
        drawCard(c, t);
      }
      SN.dx = 0; SN.dy = 0;
      ctx.restore();
    }

    resize();
    if (S.fontsReady) S.fontsReady.then(function () { measureLabels(); });

    return {
      resize: resize,
      render: render,
      rectAt: rectAt,
      setStaticRect: function (r) { staticRect = r || null; },
      zoomAt: function (p) { return camera(p).z; },
      /* verificação: caixas dos cartões na tela, visibilidade e tamanho do rótulo */
      debugLayout: function (p) {
        var cam = camera(p);
        return {
          R: cam.R, z: cam.z, z0: z0, layout: layout, tune: JSON.parse(JSON.stringify(tune)), slideF: JSON.parse(JSON.stringify(slideF)), fs: world.fs,
          slab: [cam.ox + world.slab.x * cam.z, cam.oy + world.slab.y * cam.z, world.slab.w * cam.z, world.slab.h * cam.z],
          scene: staticRect ? null : sceneRect(staticRect ? 1 : p, cam.R),
          diagonals: (function () {
            var g = frameGeometry(staticRect ? 1 : p), n = 0;
            var chk = function (pl) { if (!pl) return; for (var i = 1; i < pl.pts.length; i++) { var a = pl.pts[i - 1], b = pl.pts[i]; if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) n++; } };
            Object.keys(g.conns).forEach(function (k) { chk(g.conns[k]); });
            Object.keys(g.edges).forEach(function (k) { chk(g.edges[k]); });
            g.extra.forEach(chk); chk(g.ring);
            return n;
          })(),
          cards: world.cards.map(function (c) {
            var o = slideAt(c, staticRect ? 1 : p);
            var x = cam.ox + (c.x + o.x) * cam.z, y = cam.oy + (c.y + o.y) * cam.z, w = c.w * cam.z, h = c.h * cam.z, R = cam.R;
            var vw = Math.max(0, Math.min(x + w, R.x + R.w) - Math.max(x, R.x));
            var vh = Math.max(0, Math.min(y + h, R.y + R.h) - Math.max(y, R.y));
            return { i: c.i, rect: [x, y, w, h], vis: [vw, vh], frac: (vw * vh) / (w * h), alpha: vw > 0 && vh > 0 ? 1 : 0,
              fs: c.fs * cam.z, fsIdx: c.fsIdx * cam.z, fsWorld: c.fs, label: c.label, w: c.w };
          })
        };
      }
    };
  }

  window.IronVisuals = { createAILayer: createAILayer };
})();
