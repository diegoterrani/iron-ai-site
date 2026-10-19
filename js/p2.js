/* =========================================================================
   IRON AI — p2.js (home, parte 2)
   - Camadas que cobrem a anterior (barra: mecanismo 6): cada seção fica presa
     pela base (sticky com top negativo) enquanto a seguinte sobe por cima.
   - Esteira em cartões empilhados (mecanismo 3): cartões ProductCard presos no topo;
     o coberto encolhe (0,96 -> 0,90, pela largura, em px inteiros) e sobe 24 px por
     cartão acima dele; a faixa visível de cada um mostra o visual em accent. O
     visual interno entra em 2x e chega a 1x quando o cartão assenta (viewBox).
   - Transição por zoom (mecanismos 4 e 7): área fixa de 100vh durante 300vh; a 1x
     uma grade de painéis separados com o central (o maior) no meio; os 6 de fora
     crescem até 4,2–9x em ritmos próprios, empurrados pelo central, sem sobreposição;
     o central cobre a área sob o header, fica em tela cheia (núcleo IRON AI ligado às
     11 áreas) e a câmera entra no núcleo, que vira o fundo dos casos (mecanismo 6).
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
  ['paper', 'soft', 'surface', 'surface-2', 'band', 'acid', 'icon-bg', 'accent', 'accent-text', 'line', 'text',
   'clay', 'kraft', 'manilla', 'oat', 'modal-bg'].forEach(function (n) {
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
      /* padding inferior da seção: space-8, ou space-7 no mobile e nas janelas com menos
         de 700 px de altura, onde o cartão só fica com a altura mínima do guia (420) com
         space-7 embaixo (design-system.md, "Pilha da esteira") */
      M.padB = (M.W <= 640 || M.H < 700) ? 78 : 120;
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
    if (casos) {
      /* os casos entram como camada que cobre o clímax: a seção começa (H - header) px
         antes do fim da área fixa e sobe por cima dela, com a borda em hairline */
      M.overlap = reduced ? 0 : Math.max(0, M.H - M.hdr);
      casos.style.marginTop = M.overlap ? -M.overlap + 'px' : '';
      casos.style.setProperty('--overlap', M.overlap + 'px');
    }
    if (zoom && canvas) {
      M.zoomTop = docTop(zoom);
      M.zoomLen = Math.max(1, zoom.offsetHeight - (stage ? stage.offsetHeight : M.H));
      M.pc = reduced ? 1 : U.clamp(1 - (M.overlap || 0) / M.zoomLen, 0.5, 1);   /* núcleo cobre a tela */
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
    return pad + 24 + ['.stack__intro', '.stack__price'].reduce(function (sum, q) { return sum + c.querySelector(q).offsetHeight; }, 0);
  }
  function layoutCards() {
    cards.forEach(function (c) { c.style.width = ''; c.style.transform = ''; });
    list.style.setProperty('--card-h', 'auto');          /* altura natural, para medir */
    var prefer = M.H - M.T - M.padB, maxH = M.H - M.hdr - M.padB;
    var tries = [];
    if (reduced) {                                          /* estático: altura natural, conteúdo inteiro */
      list.setAttribute('data-mode', M.W > 640 ? 'side' : 'band1');
      list.removeAttribute('data-tight');
      M.mode = list.getAttribute('data-mode'); M.cardH = 0; M.Wc = Math.round(list.getBoundingClientRect().width);
      return;
    }
    /* breakpoint do design system (640): acima, visual e texto lado a lado (o visual
       fica com a altura toda do cartão e se lê a 2x -> 1x); até 640, faixa com o texto
       antes do visual */
    if (M.W > 640) tries.push(['side', 62, false], ['side', 58, false], ['side', 52, false], ['side', 48, false], ['side', 44, false], ['side', 44, true]);
    else tries.push(['band1', 0, false], ['band1', 0, true]);
    var pick = null, best = null;
    function tryMode(mode, fr, tight) {
      list.setAttribute('data-mode', mode);
      if (tight) list.setAttribute('data-tight', ''); else list.removeAttribute('data-tight');
      list.style.setProperty('--vis-a', (fr || 58) + 'fr'); list.style.setProperty('--vis-b', (100 - (fr || 58)) + 'fr');
      var need = 0;
      cards.forEach(function (c) { need = Math.max(need, Math.ceil(bodyNeed(c, mode)) + 2); });
      /* o nome inteiro cabe na coluna: a palavra mais longa ("Autodiagnóstico",
         "Implementação") nunca passa da borda do cartão */
      var namesFit = cards.every(function (c) { var n = c.querySelector('.stack__name'); return n.scrollWidth <= n.clientWidth + 1; });
      var h, band, ok;
      /* altura mínima do ProductCard (420, ds/components/ProductCard) sempre que couber */
      var minH = Math.min(420, maxH);
      if (mode === 'side') {
        h = Math.min(Math.max(prefer, need, minH), 700); band = h; ok = need <= Math.min(maxH, 700) && namesFit;
        h = Math.min(Math.max(h, need), maxH);
      } else {
        var minBand = Math.max(100, Math.round(0.26 * prefer));
        h = Math.min(Math.max(prefer, need + minBand, minH), maxH); band = h - need; ok = band >= minBand;
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
      /* coberto (só a borda de 24 px à vista): o campo do visual desce um degrau de
         valor por cartão por cima (manilla -> kraft -> clay), para as bordas não
         repetirem a cor do cartão da frente */
      /* o degrau entra assim que o cartão de cima começa a cobrir: sinal de camada desde
         o início do percurso */
      var covered = depth > 1.02 ? 2 : (depth > 0.02 ? 1 : 0);
      var key = ty + '|' + w + '|' + v.toFixed(4) + '|' + covered;
      if (stackState[i] === key) continue;
      stackState[i] = key;
      cards[i].style.transform = ty ? 'translateY(' + ty + 'px)' : '';
      cards[i].style.width = cut ? w + 'px' : '';
      if (covered) cards[i].setAttribute('data-covered', String(covered)); else cards[i].removeAttribute('data-covered');
      if (svgs[i]) zoomBox(svgs[i], v);
    }
  }

  /* ---------------------------------------------------------------------
     Zoom (barra: mecanismos 4 e 7). Área fixa de 100vh durante 340vh; p vai de 0 a 1:
     - divergência (p até 0,72·pc): a 1x, sete painéis separados por vãos sobre o chão
       `band`, de tamanhos diferentes. O central (25% da área sob o header no desktop) é
       o mais lento: cresce de 1x a 4x e termina cobrindo a área sob o header. Os seis de
       fora crescem de 1x a 4,6–9x, cada um no seu ritmo e sempre mais depressa que o
       central. Cada um fica preso pela borda que dá para o central (a âncora), que o
       central empurra para fora; o vão de cada painel abre no seu ritmo. Assim os de fora
       ocupam a sobra entre o central e a borda da tela até o central cobrir tudo: nunca
       há central emoldurado sobre campo vazio (mecanismo 4, sem faixa vazia);
     - clímax (até pc): o central a 100% sob o header, o núcleo IRON AI ligado aos 6
       módulos setoriais, com os nomes (mecanismo 7);
     - núcleo (de pc a 1): a câmera entra no núcleo (paper + grade de hairlines, a grade
       dos casos) atrás da camada dos casos, que sobe por cima (mecanismo 6).
     Campos em clay/kraft/manilla/oat (vizinhos em valores diferentes), figuras em paper,
     um destaque clay pequeno por painel, traços em accent-text (em text sobre clay).
     Rótulos de 12px ou mais, inteiros ou nada. Pixel inteiro, só tokens, sem opacidade.
     --------------------------------------------------------------------- */
  var P1 = 0.72;
  var PANELS = [], CEN = null;
  var FONT = (getComputedStyle(root).getPropertyValue('--font-sans') || 'sans-serif').trim();
  var MONO = (getComputedStyle(root).getPropertyValue('--font-mono') || 'monospace').trim();

  function setupZoom() {
    var land = M.sw >= M.ha, mob = M.W <= 760;
    var G0 = mob ? 12 : 16;                                  /* vão a 1x, em px */
    M.G0 = G0;
    var gx = G0 / M.sw, gy = G0 / M.ha, m = (mob ? 22 : 32) / M.ha;
    var top = -0.5 + m, bot = 0.5 - m;
    M.orient = land ? 'paisagem' : 'retrato';
    /* central: miniatura da área sob o header (mesma proporção), para cobri-la sem
       distorção. 25% no desktop (4x, como a referência); no retrato, 44% da largura,
       para o rótulo e o wordmark caberem inteiros a 1x */
    var h0 = land ? 0.125 : 0.22, hx = h0, hy = h0;
    var ty = -(hy + gy), by = hy + gy, sx = hx + gx, g2 = gx / 2;
    /* larguras a partir da costura (faixas de cima e de baixo) e das laterais */
    /* no retrato as laterais vão até além da borda da tela (são estreitas: assim o
       rótulo cabe inteiro) */
    var w = land ? { ho: 0.36, re: 0.30, fi: 0.30, sa: 0.38, ar: 0.20, ig: 0.24 }
                 : { ho: 0.42, re: 0.36, fi: 0.36, sa: 0.42, ar: 0.52 - sx, ig: 0.52 - sx };
    var dT = land ? 0.06 : 0.04, dB = land ? 0.05 : 0.04;      /* alturas diferentes: sem mosaico */
    /* side: faixa em que o painel fica (top, bot, l, r); a: âncora (na borda que dá para o
       central); S: escala final; e: expoente do ritmo (<= 1,3, o do central: nunca mais
       lento que ele); k: ritmo em que o vão abre; chip: canto do rótulo (o interno) */
    PANELS = [
      { kind: 'hotel', field: 'kraft', label: 'Hotelaria', side: 'top', S: 4.6, e: 1.0, k: 1.4, chip: 'br',
        nat: [-g2 - w.ho, -g2, top, ty], a: [-g2, ty] },
      { kind: 'restaurante', field: 'oat', label: 'Restaurantes', side: 'top', S: 6.2, e: 0.9, k: 2.4, chip: 'bl',
        nat: [g2, g2 + w.re, top + dT, ty], a: [g2, ty] },
      { kind: 'areas', field: 'oat', label: '11 áreas', side: 'l', S: 5.4, e: 1.1, k: 0.8, chip: 'tr',
        nat: [-sx - w.ar, -sx, -hy, hy], a: [-sx, 0] },
      { kind: 'igaming', field: 'manilla', label: 'iGaming', side: 'r', S: 7.4, e: 0.95, k: 2.0, chip: 'tl',
        nat: [sx, sx + w.ig, -hy, hy], a: [sx, 0] },
      { kind: 'fintech', field: 'manilla', label: 'Fintech', side: 'bot', S: 8, e: 1.05, k: 1.7, chip: 'tr',
        nat: [-g2 - w.fi, -g2, by, bot - dB], a: [-g2, by] },
      { kind: 'saude', field: 'kraft', label: 'Saúde', side: 'bot', S: 9, e: 0.85, k: 0.6, chip: 'tl',
        nat: [g2, g2 + w.sa, by, bot], a: [g2, by] }
    ];
    /* as costuras entre os dois painéis de cima e os dois de baixo derivam em sentidos
       opostos (fração da largura, em q = 1) */
    M.seamT = -0.05; M.seamB = 0.06;
    CEN = { kind: 'centro', label: 'Qualquer setor', hx: hx, hy: hy, S: 0.5 / h0, e: 1.3 };
    PANELS.push(CEN);
    var nf = land ? 0.4 : 0.42;                               /* lado do núcleo, em fração do painel */
    CEN.nu = [0.5 - nf / 2, 0.5 + nf / 2]; CEN.nv = [0.5 - nf / 2, 0.5 + nf / 2];
    CEN.Send = CEN.S / nf;                                    /* o núcleo cobre a tela, nas duas direções juntas */
    /* módulos setoriais (os casos de uso que vêm a seguir) ligados ao núcleo: 3 de cada
       lado no desktop; no retrato, duas fileiras de 3 abaixo do núcleo. Cada um é um
       bloco em manilla ou oat (alternados, contra o campo clay); no clímax ganha o nome */
    var mu = 22 / M.sw, names = ['Restaurantes', 'Hotelaria', 'iGaming', 'Fintech', 'Saúde', 'Sob medida'];
    var fields = ['oat', 'manilla', 'oat', 'manilla', 'oat', 'manilla'];
    var n0 = CEN.nu[0], cards = [], ch;
    if (land) {
      var sv = [0.4, 0.5, 0.6]; ch = 0.075;
      var cw = Math.min(0.2, n0 - 0.025 - mu), su = n0 - 0.025 - cw / 2;
      sv.forEach(function (v, i) { cards.push({ u: su, v: v, w: cw, h: ch, name: names[i], field: fields[i] }); });
      sv.forEach(function (v, i) { cards.push({ u: 1 - su, v: v, w: cw, h: ch, name: names[3 + i], field: fields[3 + i] }); });
      CEN.cardFont = 20;
    } else {
      ch = 0.06;
      /* três fileiras de dois abaixo do núcleo, de baixo para cima: as ligações das de
         baixo passam por trás das de cima */
      [2, 1, 0].forEach(function (row) {
        [0.3, 0.7].forEach(function (u, col) {
          var i = row * 2 + col;
          cards.push({ u: u, v: 0.76 + row * 0.08, w: 0.38, h: ch, name: names[i], field: fields[i] });
        });
      });
      CEN.cardFont = 16;
    }
    CEN.cards = cards;
  }

  /* Geometria de um painel de fora, em px de canvas, com a escala própria s, o central
     em sc e o avanço q da divergência:
     - a âncora (ponto da borda que dá para o central) acompanha a borda do central, a
       um vão que abre no ritmo do painel (k) e nunca passa de 45% da sobra até a borda
       da tela, para o painel continuar visível até o central cobrir tudo;
     - o painel cresce a partir da âncora, com a escala s (conteúdo em R);
     - V é a parte que o painel ocupa: as laterais ficam na altura do central, entre as
       faixas de cima e de baixo, para ninguém se sobrepor. */
  /* vão entre o painel e o central: a 1x um vão de G0; ao longo da divergência o
     central avança por cima da borda de cada painel (vão negativo = sobreposição de
     até ~2·G0, no ritmo k do painel): o central fica à frente, os de fora passam por
     baixo dele. Um vão positivo nunca passa de 45% da sobra até a borda da tela */
  function gapPx(pn, q, sobra) {
    var g = M.G0 * (1 - 2.6 * q) + M.G0 * 0.5 * (pn.k - 1.4) * q;
    return g > 0 ? Math.min(g, Math.max(0, 0.45 * sobra)) : g;
  }
  function geomOf(pn, s, sc, shift, q) {
    var n = pn.nat, a = pn.a, cy = M.oy - (shift || 0);
    var cxp = CEN.hx * sc * M.sw, cyp = CEN.hy * sc * M.ha, Ax, Ay;
    q = q || 0;
    if (pn.side === 'top' || pn.side === 'bot') {
      var g = gapPx(pn, q, M.ha / 2 - cyp);
      Ay = pn.side === 'top' ? cy - cyp - g : cy + cyp + g;
      var seam = (pn.side === 'top' ? M.seamT : M.seamB) * q * M.sw, gs = M.G0 * (1 + 3 * q) / 2;
      Ax = M.ox + seam + (a[0] < 0 ? -gs : gs);
    } else {
      var g2 = gapPx(pn, q, M.sw / 2 - cxp);
      Ax = pn.side === 'l' ? M.ox - cxp - g2 : M.ox + cxp + g2;
      Ay = cy;
    }
    var r = { x: Ax + (n[0] - a[0]) * s * M.sw, y: Ay + (n[2] - a[1]) * s * M.ha, w: (n[1] - n[0]) * s * M.sw, h: (n[3] - n[2]) * s * M.ha };
    var v = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (pn.side === 'l' || pn.side === 'r') {
      var y0 = Math.max(v.y, cy - cyp), y1 = Math.min(v.y + v.h, cy + cyp);
      v.y = y0; v.h = Math.max(0, y1 - y0);
    }
    var gg = (pn.side === 'top' || pn.side === 'bot') ? g : g2;
    return { R: r, V: v, ov: Math.max(0, -gg), gw: Math.round(M.G0 * (1 + 2.5 * q)) };
  }
  function centerRect(sc, shift) {
    var cy = M.oy - (shift || 0);
    return { x: M.ox - CEN.hx * sc * M.sw, y: cy - CEN.hy * sc * M.ha, w: 2 * CEN.hx * sc * M.sw, h: 2 * CEN.hy * sc * M.ha };
  }
  /* fases (M.pc = ponto em que a camada dos casos começa a subir pela base):
     divergência até 0,72·pc; clímax parado de 0,72·pc a pc (o central a 100%, nada por
     cima: mecanismo 7); depois a câmera entra no núcleo atrás da camada dos casos, que
     cobre a área fixa de baixo para cima (mecanismo 6). Cada painel de fora vai de 1x a
     S (4,6–9x) com expoente e <= 1,3 e S > 4: em todo quadro ele está maior que o
     central (ritmo da referência: o central é o mais lento) */
  function zoomState(p) {
    var pc = M.pc || 1, a = P1 * pc;
    var q = U.clamp(p / a, 0, 1), sc, phase;
    if (p <= a) { sc = 1 + (CEN.S - 1) * Math.pow(q, CEN.e); phase = 'divergência'; }
    else if (p <= pc) { sc = CEN.S; phase = 'clímax'; }
    else { sc = CEN.S + (CEN.Send - CEN.S) * U.clamp((p - pc) / (1 - pc), 0, 1); phase = 'núcleo'; }
    return { p: p, q: q, phase: phase, sc: sc, s: PANELS.map(function (pn) {
      return pn === CEN ? sc : 1 + (pn.S - 1) * Math.pow(q, pn.e);
    }) };
  }
  function zoomP(y) { return U.clamp((y - M.zoomTop) / M.zoomLen, 0, 1); }

  /* desenho em px de dispositivo, sempre em pixel inteiro; um bloco cortado por uma
     borda da área visível que ficaria com menos de 8 px não é desenhado */
  var EDGE = { t: 0, b: 1e9, l: 0, r: 1e9 }, SLIVER = 8;
  function R(x0, y0, x1, y1) {
    if ((y0 < EDGE.t && y1 > EDGE.t && y1 - EDGE.t < SLIVER) || (y0 < EDGE.b && y1 > EDGE.b && EDGE.b - y0 < SLIVER) ||
        (x0 < EDGE.l && x1 > EDGE.l && x1 - EDGE.l < SLIVER) || (x0 < EDGE.r && x1 > EDGE.r && EDGE.r - x0 < SLIVER)) return false;
    var X0 = Math.round(x0 * M.dpr), Y0 = Math.round(y0 * M.dpr), X1 = Math.round(x1 * M.dpr), Y1 = Math.round(y1 * M.dpr);
    if (X1 <= X0 || Y1 <= Y0) return false;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    return true;
  }
  function inside(x0, y0, x1, y1) { return x0 >= EDGE.l && x1 <= EDGE.r && y0 >= EDGE.t && y1 <= EDGE.b; }
  /* rótulo: etiqueta paper com texto em text (16:1); inteiro ou nada */
  function tagFont(f, ls) {
    ctx.font = '600 ' + Math.round(f * M.dpr) + 'px ' + MONO;
    if ('letterSpacing' in ctx) ctx.letterSpacing = ((ls === undefined ? 0.13 : ls) * f * M.dpr).toFixed(2) + 'px';
  }
  function chipSize(lines, f, ls) {
    tagFont(f, ls);
    var w = 0; lines.forEach(function (t) { w = Math.max(w, ctx.measureText(t.toUpperCase()).width / M.dpr); });
    return { w: Math.ceil(w) + 2 * Math.round(0.55 * f), h: lines.length * Math.round(1.35 * f) + Math.round(0.6 * f) };
  }
  function chip(lines, x, y, f, box, ls) {
    var z = chipSize(lines, f, ls), lh = Math.round(1.35 * f);
    if (!inside(x, y, x + z.w, y + z.h)) return false;
    if (box && (x < box.x || y < box.y || x + z.w > box.x + box.w || y + z.h > box.y + box.h)) return false;
    ctx.fillStyle = C.paper; R(x, y, x + z.w, y + z.h);
    ctx.fillStyle = C.text; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    tagFont(f, ls);
    lines.forEach(function (t, i) {
      ctx.fillText(t.toUpperCase(), Math.round((x + Math.round(0.55 * f)) * M.dpr), Math.round((y + Math.round(0.3 * f) + lh * (i + 0.5)) * M.dpr));
    });
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return true;
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

  /* Painel de fora. O conteúdo fica perto da âncora (o canto ou a borda que dá para o
     central), a parte que continua na tela enquanto o painel cresce; o destaque clay
     fica ali. As figuras são paper com contorno em accent-text, que engrossa com o
     painel: ampliadas, continuam desenho (objeto com borda), não bloco branco.
     Devolve true se o rótulo foi desenhado. */
  function drawNeighbor(pn, s, sc, shift, vTop, vBot, q) {
    var g = geomOf(pn, s, sc, shift, q), r = g.R, v = g.V;
    var ix = Math.min(v.x + v.w, M.sw) - Math.max(v.x, 0), iy = Math.min(v.y + v.h, vBot) - Math.max(v.y, vTop);
    if (v.w <= 0 || v.h <= 0 || ix < 12 || iy < 12) return false;
    var side = pn.side === 'l' || pn.side === 'r';
    /* laterais: um vão em band acima e abaixo, por cima da borda das faixas de cima e
       de baixo (que passam por baixo delas nos cantos) */
    if (side) { ctx.fillStyle = C.band; R(v.x, v.y - g.gw, v.x + v.w, v.y); R(v.x, v.y + v.h, v.x + v.w, v.y + v.h + g.gw); }
    ctx.fillStyle = C[pn.field] || C.manilla;                 /* campo do painel: tons alternados entre vizinhos */
    if (!R(v.x, v.y, v.x + v.w, v.y + v.h)) return false;
    /* borda do painel em accent-text (traço, engrossa com o painel): separa os painéis
       entre si e do chão, como os vãos escuros da referência */
    var tb = Math.max(1, Math.round(2 * Math.sqrt(s) * M.dpr)) / M.dpr;
    ctx.fillStyle = C['accent-text'];
    R(v.x, v.y, v.x + v.w, v.y + tb); R(v.x, v.y + v.h - tb, v.x + v.w, v.y + v.h);
    R(v.x, v.y, v.x + tb, v.y + v.h); R(v.x + v.w - tb, v.y, v.x + v.w, v.y + v.h);
    ctx.save();
    var X0 = Math.round(Math.max(v.x, 0) * M.dpr), Y0 = Math.round(Math.max(v.y, vTop) * M.dpr);
    var X1 = Math.round(Math.min(v.x + v.w, M.sw) * M.dpr), Y1 = Math.round(Math.min(v.y + v.h, vBot) * M.dpr);
    ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    var ux = function (u) { return r.x + u * r.w; }, vy = function (t) { return r.y + t * r.h; };
    /* traço: 2 px a 1x, engrossa com o painel (continua traço, nunca bloco) */
    var tl = Math.max(1, Math.round(2 * Math.sqrt(s) * M.dpr)) / M.dpr, i, j;
    var INK = C['accent-text'];
    function box(x0, y0, x1, y1, fill) {                      /* figura: preenchimento + contorno */
      ctx.fillStyle = fill || C.paper; R(x0, y0, x1, y1);
      ctx.fillStyle = INK;
      R(x0, y0, x1, y0 + tl); R(x0, y1 - tl, x1, y1); R(x0, y0, x0 + tl, y1); R(x1 - tl, y0, x1, y1);
    }
    function ring(x0, y0, x1, y1) {                           /* só o contorno */
      ctx.fillStyle = INK;
      R(x0, y0, x1, y0 + tl); R(x0, y1 - tl, x1, y1); R(x0, y0, x0 + tl, y1); R(x1 - tl, y0, x1, y1);
    }
    if (pn.kind === 'hotel') {
      /* âncora embaixo à direita: prédio à direita, janelas em contorno; a de baixo à
         direita acesa em clay */
      box(ux(0.36), vy(0.2), ux(0.8), vy(1.02));
      for (i = 0; i < 3; i++) for (j = 0; j < 4; j++) {
        var wx = ux(0.42 + i * 0.13), wy = vy(0.28 + j * 0.17), wx1 = ux(0.42 + i * 0.13 + 0.07), wy1 = vy(0.28 + j * 0.17 + 0.09);
        if (i === 2 && j === 3) { ctx.fillStyle = C.clay; R(wx, wy, wx1, wy1); } else ring(wx, wy, wx1, wy1);
      }
    } else if (pn.kind === 'restaurante') {
      /* âncora embaixo à esquerda: duas fileiras de mesas com cadeiras; um prato em clay */
      for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) {
        var cxp = ux(0.13 + i * 0.22), cyp = vy(0.5 + j * 0.27), tw = 0.06 * r.w, th = 0.075 * r.h, d = Math.min(tw, th);
        box(cxp - d * 0.45, cyp - th - d * 0.85, cxp + d * 0.45, cyp - th - d * 0.25);
        box(cxp - d * 0.45, cyp + th + d * 0.25, cxp + d * 0.45, cyp + th + d * 0.85);
        box(cxp - tw, cyp - th, cxp + tw, cyp + th);
        if (i === 0 && j === 1) { ctx.fillStyle = C.clay; R(cxp - d * 0.45, cyp - d * 0.45, cxp + d * 0.45, cyp + d * 0.45); }
      }
    } else if (pn.kind === 'areas') {
      /* âncora na borda direita: 11 caixas em 3 colunas (o canto de cima à direita fica
         livre para o rótulo); a do meio à direita com o destaque em clay */
      var nn = 0;
      for (j = 0; j < 4 && nn < 11; j++) for (i = 0; i < 3 && nn < 11; i++) {
        if (j === 0 && i === 2) continue;
        box(ux(0.08 + i * 0.29 + 0.035), vy(0.08 + j * 0.215 + 0.035), ux(0.08 + (i + 1) * 0.29 - 0.035), vy(0.08 + (j + 1) * 0.215 - 0.035));
        if (nn === 4) { ctx.fillStyle = C.clay; R(ux(0.08 + i * 0.29 + 0.06), vy(0.08 + j * 0.215 + 0.06), ux(0.08 + i * 0.29 + 0.12), vy(0.08 + j * 0.215 + 0.12)); }
        nn++;
      }
    } else if (pn.kind === 'igaming') {
      /* âncora na borda esquerda: quadro de odds com as cotações à esquerda; a do meio em clay */
      for (j = 0; j < 3; j++) {
        var yy = vy(0.22 + j * 0.22), hh = 0.13 * r.h;
        if (j === 1) { ctx.fillStyle = C.clay; R(ux(0.08), yy, ux(0.2), yy + hh); } else box(ux(0.08), yy, ux(0.2), yy + hh);
        box(ux(0.24), yy, ux(0.36), yy + hh);
        box(ux(0.42), yy, ux(0.9), yy + hh);
        ctx.fillStyle = INK; R(ux(0.47), yy + hh / 2 - tl / 2, ux(0.72), yy + hh / 2 + tl / 2);
      }
    } else if (pn.kind === 'fintech') {
      /* âncora em cima à direita: cartão com chip em clay e duas linhas; barras embaixo à esquerda */
      box(ux(0.46), vy(0.15), ux(0.9), vy(0.52));
      ctx.fillStyle = C.clay; R(ux(0.54), vy(0.22), ux(0.62), vy(0.32));
      ctx.fillStyle = INK; R(ux(0.54), vy(0.4), ux(0.8), vy(0.4) + tl); R(ux(0.54), vy(0.46), ux(0.7), vy(0.46) + tl);
      [0.2, 0.32, 0.44].forEach(function (h, k) { box(ux(0.1 + k * 0.09), vy(0.9 - h), ux(0.1 + k * 0.09 + 0.06), vy(0.9)); });
    } else if (pn.kind === 'saude') {
      /* âncora em cima à esquerda: monitor com a linha do pulso (degraus ortogonais) e o pico em clay */
      box(ux(0.08), vy(0.15), ux(0.64), vy(0.58));
      var pts = [[0.12, 0.38], [0.24, 0.38], [0.24, 0.23], [0.3, 0.23], [0.3, 0.5], [0.36, 0.5], [0.36, 0.32], [0.42, 0.32], [0.42, 0.38], [0.6, 0.38]];
      ctx.fillStyle = INK;
      for (i = 1; i < pts.length; i++) {
        var p0 = pts[i - 1], p1 = pts[i];
        if (p0[1] === p1[1]) R(ux(Math.min(p0[0], p1[0])), vy(p0[1]) - tl / 2, ux(Math.max(p0[0], p1[0])) + tl / 2, vy(p0[1]) + tl / 2);
        else R(ux(p0[0]) - tl / 2, vy(Math.min(p0[1], p1[1])), ux(p0[0]) + tl / 2, vy(Math.max(p0[1], p1[1])));
      }
      ctx.fillStyle = C.clay; R(ux(0.22), vy(0.18), ux(0.26), vy(0.18) + 0.04 * r.w);
    }
    ctx.restore();
    /* rótulo no canto interno, fora da parte que o central cobre (ov); cresce pouco com
       o painel (até 1,35x) para não disputar com o central */
    var f = 12 * Math.min(1.5, 1 + 0.18 * (s - 1)), off = Math.round(8 * f / 12) + Math.ceil(tb), ov = g.ov;
    var vv = { x: v.x, y: v.y, w: v.w, h: v.h };
    if (pn.side === 'top') vv.h -= ov; else if (pn.side === 'bot') { vv.y += ov; vv.h -= ov; }
    else if (pn.side === 'l') vv.w -= ov; else { vv.x += ov; vv.w -= ov; }
    if (vv.w <= 0 || vv.h <= 0) return false;
    /* tracking .13em; se não couber, .06em (design-system.md, regra 4) e depois um recuo
       menor; se nem assim couber, o chip não entra (inteiro ou nada) */
    var ls = 0.13;
    if (chipSize([pn.label], f, ls).w + 2 * off > vv.w) ls = 0.06;
    if (chipSize([pn.label], f, ls).w + 2 * off > vv.w) off = Math.min(off, 5);
    var z = chipSize([pn.label], f, ls);
    var lx = pn.chip.charAt(1) === 'r' ? vv.x + vv.w - off - z.w : vv.x + off;
    var ly = pn.chip.charAt(0) === 'b' ? vv.y + vv.h - off - z.h : vv.y + off;
    return chip([pn.label], lx, ly, f, vv, ls);
  }

  /* central: campo clay, núcleo (paper + grade, com o wordmark IRON AI) no meio, os 6
     módulos ligados a ele por traços em tinta e o rótulo "Qualquer setor" no alto.
     names: desenhar os nomes dos módulos (só quando nenhum rótulo de fora está na tela,
     para nada se repetir na vista) */
  function drawCentro(sc, shift, names, p) {
    var r = centerRect(sc, shift);
    var ux = function (u) { return r.x + u * r.w; }, vy = function (v) { return r.y + v * r.h; };
    var t1 = Math.max(1, Math.round(M.dpr)), k = sc / CEN.S;
    ctx.fillStyle = C.clay; R(r.x, r.y, r.x + r.w, r.y + r.h);           /* campo do central: clay, o mais forte */
    /* borda do central em text (traço sobre clay): o plano da frente, nítido sobre os
       de fora; sai quando o central chega a menos de 18 px de cobrir a área visível
       (no clímax não há moldura: mecanismo 7) */
    var mgn = Math.min(r.x, M.sw - (r.x + r.w), r.y - EDGE.t, EDGE.b - (r.y + r.h));
    if (mgn >= 18) {
      var tc = Math.max(1, Math.round(3 * M.dpr)) / M.dpr;
      ctx.fillStyle = C.text;
      R(r.x, r.y, r.x + r.w, r.y + tc); R(r.x, r.y + r.h - tc, r.x + r.w, r.y + r.h);
      R(r.x, r.y, r.x + tc, r.y + r.h); R(r.x + r.w - tc, r.y, r.x + r.w, r.y + r.h);
    }
    var nx0 = ux(CEN.nu[0]), nx1 = ux(CEN.nu[1]), ny0 = vy(CEN.nv[0]), ny1 = vy(CEN.nv[1]);
    ctx.fillStyle = C.paper; R(nx0, ny0, nx1, ny1);
    ctx.fillStyle = C.line;
    /* a grade do núcleo é a própria grade dos casos vista por uma janela: passo de 48
       px na tela (não amplia), colunas em W/2 + k·48 e, quando a camada dos casos sobe
       (p > pc), as linhas sobem junto com ela; assim, na borda da camada, as duas
       grades coincidem e o núcleo vira o fundo da seção seguinte (mecanismo 4) */
    var pitch = G, cxs = M.ox, cys = M.oy - shift - Math.max(0, (p || 0) - (M.pc || 1)) * M.zoomLen;
    var NX0 = Math.round(nx0 * M.dpr), NX1 = Math.round(nx1 * M.dpr), NY0 = Math.round(ny0 * M.dpr), NY1 = Math.round(ny1 * M.dpr);
    if (pitch >= 3) {
      var a;
      for (a = Math.ceil((nx0 - cxs) / pitch); cxs + a * pitch < nx1; a++) ctx.fillRect(Math.round((cxs + a * pitch) * M.dpr), NY0, t1, NY1 - NY0);
      for (a = Math.ceil((ny0 - cys) / pitch); cys + a * pitch < ny1; a++) ctx.fillRect(NX0, Math.round((cys + a * pitch) * M.dpr), NX1 - NX0, t1);
    }
    var lw = Math.max(1, Math.round(2 * k)), fpx = CEN.cardFont * k;
    /* nome de cada módulo numa etiqueta paper dentro do bloco: um só tamanho para os 6,
       o maior em que todos cabem inteiros com 12 px ou mais; se algum não couber,
       nenhum é desenhado (nunca uns com nome e outros sem) */
    var fzAll = names ? Math.floor(fpx + 1e-6) : 0, linesOf = [], insOf = function (c) { return Math.max(2, Math.round(0.06 * c.h * r.h)); };
    for (; fzAll >= 12; fzAll--) {
      tagFont(fzAll, 0.06);
      var lhA = Math.round(fzAll * 1.2), okAll = true;
      linesOf = CEN.cards.map(function (c) {
        var ins = insOf(c), w = c.w * r.w - 2 * ins - 2 * Math.max(3, 0.25 * fzAll), h = c.h * r.h - 2 * ins;
        var L = wrap(c.name.toUpperCase(), w), wm = 0;
        L.forEach(function (t) { wm = Math.max(wm, ctx.measureText(t).width / M.dpr); });
        if (L.length * lhA > h - 4 || wm > w || L.length > 2) okAll = false;
        return L;
      });
      if (okAll) break;
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    CEN.cards.forEach(function (c, ci) {
      var x0 = ux(c.u - c.w / 2), x1 = ux(c.u + c.w / 2), y0 = vy(c.v - c.h / 2), y1 = vy(c.v + c.h / 2);
      var mx = ux(c.u), my = vy(c.v), h2 = lw / 2;
      ctx.fillStyle = C.text;
      if (c.v > CEN.nv[1]) {                                      /* embaixo: sobe até o núcleo (passando entre os cartões de cima) */
        R(mx - h2, ny1, mx + h2, y0);
      } else if (c.u > 0.5) R(nx1, my - h2, x0, my + h2);
      else R(x1, my - h2, nx0, my + h2);
      ctx.fillStyle = C[c.field]; if (!R(x0, y0, x1, y1)) return;
      if (!inside(x0, y0, x1, y1)) return;                    /* nome inteiro ou nada */
      var lines = fzAll >= 12 ? linesOf[ci] : null, lh = Math.round(fzAll * 1.2);
      if (lines) {
        var ins = insOf(c);
        ctx.fillStyle = C.paper; R(x0 + ins, y0 + ins, x1 - ins, y1 - ins);
        tagFont(fzAll, 0.06);
        ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        lines.forEach(function (t, i) { ctx.fillText(t, Math.round(mx * M.dpr), Math.round((my + (i - (lines.length - 1) / 2) * lh) * M.dpr)); });
        ctx.textAlign = 'left';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      }
    });
    /* o núcleo leva o wordmark IRON AI (como a laje do hero), do maior tamanho que
       couber inteiro, com 12 px ou mais (medido); só enquanto o canto do núcleo está na
       área visível: quando o núcleo cobre a tela ele já saiu pela borda e nunca fica
       por cima dos casos */
    var cw0 = nx1 - nx0, chh = ny1 - ny0;
    function wmWidth(fw) {
      if ('letterSpacing' in ctx) ctx.letterSpacing = (0.1 * fw * M.dpr).toFixed(2) + 'px';
      ctx.font = '500 ' + Math.round(fw * M.dpr) + 'px ' + FONT; var a1 = ctx.measureText('IRON').width;
      ctx.font = '800 ' + Math.round(fw * M.dpr) + 'px ' + FONT; var a2 = ctx.measureText('AI').width;
      return { iron: a1, w: (a1 + a2) / M.dpr + fw * 0.32 };
    }
    var fw = Math.min(28, Math.max(12, Math.floor(cw0 * 0.07))), pad = 0, wm = null;
    for (; fw >= 12; fw--) {
      wm = wmWidth(fw); pad = Math.max(4, Math.round(fw * 0.4));
      if (wm.w + 2 * pad <= cw0 && fw * 1.9 <= chh * 0.45) break;
    }
    if (fw >= 12 && wm && nx0 > 8 && ny0 > EDGE.t + 8 && inside(nx0, ny0, nx0 + wm.w + 2 * pad, ny0 + fw * 2)) {
      ctx.fillStyle = C.text; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      wmWidth(fw);
      var bx = Math.round((nx0 + pad) * M.dpr), by = Math.round((ny0 + pad + fw * 0.9) * M.dpr);
      ctx.font = '500 ' + Math.round(fw * M.dpr) + 'px ' + FONT;
      ctx.fillText('IRON', bx, by);
      ctx.font = '800 ' + Math.round(fw * M.dpr) + 'px ' + FONT;
      ctx.fillText('AI', bx + wm.iron + Math.round(fw * 0.32 * M.dpr), by);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    /* circuito do núcleo (em todas as escalas): as ligações dos módulos entram por
       portas na borda, seguem por um barramento de cada lado (no retrato, um embaixo)
       e chegam ao nó central em clay, com o miolo em paper. O núcleo nunca fica como
       grade vazia */
    var hcx = ux(0.5), hcy = vy(0.5), hl = Math.max(1, Math.round(2 * k)) / 2;
    var cwN = nx1 - nx0, chN = ny1 - ny0, ps = Math.max(4, Math.round(lw * 2.5));
    var wmBottom = (fw >= 12 && wm) ? ny0 + pad + fw * 1.2 : ny0;
    /* dentro do núcleo (paper) os traços são accent-text, como nas figuras; o núcleo
       tem o contorno accent-text das figuras (regra 4) */
    ctx.fillStyle = C['accent-text'];
    var tcN = Math.max(1, Math.round(2 * Math.sqrt(k) * M.dpr)) / M.dpr;
    R(nx0, ny0, nx1, ny0 + tcN); R(nx0, ny1 - tcN, nx1, ny1); R(nx0, ny0, nx0 + tcN, ny1); R(nx1 - tcN, ny0, nx1, ny1);
    if (M.orient === 'paisagem') {
      var lefts = CEN.cards.filter(function (c) { return c.u < 0.5; }), rights = CEN.cards.filter(function (c) { return c.u > 0.5; });
      [[lefts, nx0, nx0 + 0.16 * cwN], [rights, nx1, nx1 - 0.16 * cwN]].forEach(function (grp) {
        var cs = grp[0], edge = grp[1], bx = grp[2];
        var ys = cs.map(function (c) { return vy(c.v); }), y0b = Math.min.apply(null, ys), y1b = Math.max.apply(null, ys);
        if (y0b - ps < wmBottom + 4 && edge === nx0) { R(Math.min(edge, hcx), hcy - hl, Math.max(edge, hcx), hcy + hl); return; }
        ys.forEach(function (yy) {
          R(Math.min(edge, bx), yy - hl, Math.max(edge, bx), yy + hl);
          if (edge === nx0) R(edge, yy - ps / 2, edge + ps, yy + ps / 2); else R(edge - ps, yy - ps / 2, edge, yy + ps / 2);   /* porta, por dentro do núcleo */
        });
        R(bx - hl, y0b - hl, bx + hl, y1b + hl);
        R(Math.min(bx, hcx), hcy - hl, Math.max(bx, hcx), hcy + hl);
      });
    } else {
      var yb = ny1 - 0.14 * chN, xs = [ux(0.3), ux(0.7)];
      xs.forEach(function (xx) { R(xx - hl, yb, xx + hl, ny1); R(xx - ps / 2, ny1 - ps, xx + ps / 2, ny1); });
      R(xs[0] - hl, yb - hl, xs[1] + hl, yb + hl);
      R(hcx - hl, hcy, hcx + hl, yb);
    }
    R(hcx - ps / 2, ny0, hcx + ps / 2, ny0 + ps);    /* porta do rótulo no alto, por dentro do núcleo */
    var hn = Math.max(4, Math.round(Math.min(cwN, chN) * 0.09)), hi = Math.max(2, Math.round(hn * 0.4));
    ctx.fillStyle = C.clay; R(hcx - hn, hcy - hn, hcx + hn, hcy + hn);
    ctx.fillStyle = C.paper; R(hcx - hi, hcy - hi, hcx + hi, hcy + hi);
    var lab = [CEN.label];
    var f = 12 * (1 + 0.3 * (sc - 1)), ls = 0.13, z = chipSize(lab, f, ls);
    if (z.w > r.w - 8) { ls = 0.06; z = chipSize(lab, f, ls); }
    var cx0 = ux(0.5) - z.w / 2, cy0 = vy(0.15) - z.h / 2;
    ctx.fillStyle = C.text; R(ux(0.5) - lw / 2, cy0 + z.h, ux(0.5) + lw / 2, ny0);
    chip(lab, cx0, cy0, f, null, ls);
    return r;
  }
  /* acabamento das bordas da área visível: uma faixa de menos de 8 px colada no header
     ou nas laterais é coberta pelo bloco que vem logo depois dela (só cor de token; a
     grade de hairlines fica) */
  var LINE = U.rgb(U.token('--line') || '#e7e6e1'), PAPER = U.rgb(U.token('--paper') || '#faf9f5'), TOK = {};
  ['paper', 'soft', 'surface', 'surface-2', 'band', 'acid', 'accent', 'accent-text', 'line', 'text', 'clay', 'kraft', 'manilla', 'oat', 'modal-bg'].forEach(function (n) {
    var c = U.rgb(U.token('--' + n) || '#000000'); TOK[(c[0] << 16) | (c[1] << 8) | c[2]] = true;
  });
  function edgeClean(vTop, vBot) {
    var d = Math.max(1, Math.round(SLIVER * M.dpr)), Wd = canvas.width;
    var T = Math.round(vTop * M.dpr), B = Math.round(vBot * M.dpr);
    function band(x, y, w, h, vertical, fromEnd) {
      if (w <= 0 || h <= 0) return;
      var img = ctx.getImageData(x, y, w, h), a = img.data, n = vertical ? w : h, len = vertical ? h : w, changed = false;
      for (var i = 0; i < n; i++) {
        var idx = function (kk0) { var kk = fromEnd ? len - 1 - kk0 : kk0; return vertical ? (kk * w + i) * 4 : (i * w + kk) * 4; };
        var j = idx(len - 1), r = a[j], g = a[j + 1], b = a[j + 2];
        if (!TOK[(r << 16) | (g << 8) | b]) continue;
        var k = len - 1;
        while (k > 0) { var q = idx(k - 1); if (a[q] !== r || a[q + 1] !== g || a[q + 2] !== b) break; k--; }
        if (k > 0) {
          var isGrid = function (t) { return (a[t] === LINE[0] && a[t + 1] === LINE[1] && a[t + 2] === LINE[2]) || (a[t] === PAPER[0] && a[t + 1] === PAPER[1] && a[t + 2] === PAPER[2]); };
          var grid = isGrid(j);
          for (var m0 = 0; m0 < k && grid; m0++) grid = isGrid(idx(m0));
          if (grid) continue;
          changed = true; for (var m = 0; m < k; m++) { var t = idx(m); a[t] = r; a[t + 1] = g; a[t + 2] = b; a[t + 3] = 255; }
        }
      }
      if (changed) ctx.putImageData(img, x, y);
    }
    band(0, T, Wd, Math.min(d + 1, B - T), true, false);
    band(0, Math.max(T, B - d - 1), Wd, Math.min(d + 1, B - T), true, true);
    band(0, T, Math.min(d + 1, Wd), B - T, false, false);
    band(Math.max(0, Wd - d - 1), T, Math.min(d + 1, Wd), B - T, false, true);
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
    /* chão: band, fundo de seção (a camada do zoom se distingue da esteira em paper);
       depois do começo da divergência ele só aparece nos vãos */
    ctx.fillStyle = C.band; ctx.fillRect(0, 0, canvas.width, canvas.height);
    var labelsOut = 0;
    /* faixas de cima e de baixo primeiro; as laterais por cima delas nos cantos; o
       central por cima de todos */
    [0, 1, 4, 5, 2, 3].forEach(function (i) { if (drawNeighbor(PANELS[i], zs.s[i], zs.sc, shift, vTop, vBot, zs.q)) labelsOut++; });
    /* os nomes dos módulos só aparecem quando nenhum rótulo de fora está na tela */
    var c = drawCentro(zs.sc, shift, labelsOut === 0 && zs.q > 0.5, zs.p);
    /* perto de cobrir: uma sobra menor que 18 px entre o central e a borda vira campo
       campo do central (sem lasca do fundo ou de painel de fora) */
    var T = 18, ml = c.x, mr = M.sw - (c.x + c.w), mt = c.y - vTop, mb = vBot - (c.y + c.h);
    var fl = ml > 0 && ml < T, fr = mr > 0 && mr < T, ft = mt > 0 && mt < T, fb = mb > 0 && mb < T;
    ctx.fillStyle = C.clay;
    var ya = ft ? vTop : Math.max(vTop, c.y), yb = fb ? vBot : Math.min(vBot, c.y + c.h);
    var xa = fl ? 0 : Math.max(0, c.x), xb = fr ? M.sw : Math.min(M.sw, c.x + c.w);
    if (fl) R(0, ya, c.x, yb);
    if (fr) R(c.x + c.w, ya, M.sw, yb);
    if (ft) R(xa, vTop, xb, c.y);
    if (fb) R(xa, c.y + c.h, xb, vBot);
    edgeClean(vTop, vBot);
  }

  function update(y) {
    if (reduced) { drawZoom(P1 * (M.pc || 1) + 0.01, 0); return; }
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
    panelRects: function (p) { var zs = zoomState(p === undefined ? zoomP(S.scrollY()) : p); return PANELS.map(function (pn, i) { var r = pn === CEN ? centerRect(zs.sc, 0) : geomOf(pn, zs.s[i], zs.sc, 0, zs.q).V; return { kind: pn.kind, label: pn.label, S: pn === CEN ? CEN.Send : pn.S, x: r.x, y: r.y, w: r.w, h: r.h, s: zs.s[i] }; }); },
    stack: function () {
      return cards.map(function (c, i) {
        var r = c.getBoundingClientRect();
        var vb = svgs[i] ? svgs[i].getAttribute('viewBox').split(' ') : null; return { i: i, top: r.top, left: r.left, width: r.width, height: r.height, scale: r.width / M.Wc, transform: c.style.transform, v: vb ? 400 / parseFloat(vb[2]) : 1 };
      });
    }
  };
})();
