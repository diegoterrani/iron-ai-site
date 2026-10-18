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
  var casosInner = casos ? casos.querySelector('.layer__inner') : null;
  var ctx = canvas ? canvas.getContext('2d') : null;

  /* cores (tokens) */
  var C = {};
  ['paper', 'soft', 'surface', 'band', 'acid', 'icon-bg', 'accent', 'accent-text', 'line', 'text',
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
    if (casos) {
      /* os casos sobem por cima da área fixa enquanto ela mostra só a grade do núcleo:
         a seção começa (H - header) px antes do fim do zoom e o seu fundo de grade só
         começa onde a área fixa termina (--overlap) */
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
      list.setAttribute('data-mode', M.W > 980 ? 'side' : (M.W > 640 ? 'band2' : 'band1'));
      list.removeAttribute('data-tight');
      M.mode = list.getAttribute('data-mode'); M.cardH = 0; M.Wc = Math.round(list.getBoundingClientRect().width);
      return;
    }
    /* breakpoints do design system: >980 lado a lado; 641–980 faixa em 2 colunas; ≤640 faixa */
    if (M.W > 980) tries.push(['side', 62, false], ['side', 58, false], ['side', 52, false], ['side', 52, true]);
    else if (M.W > 640) tries.push(['band2', 0, false], ['band2', 0, true]);
    else tries.push(['band1', 0, false], ['band1', 0, true]);
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
      /* coberto (só a borda de 24 px à vista): o campo do visual desce um degrau de
         valor por cartão por cima (manilla -> kraft -> clay), para as bordas não
         repetirem a cor do cartão da frente */
      var covered = depth >= 1.98 ? 2 : (depth >= 0.98 ? 1 : 0);
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
     Zoom (barra: mecanismos 4 e 7). Área fixa de 100vh durante 300vh; p vai de 0 a 1:
     - p 0 a 0,6: divergência. A 1x é uma grade de painéis separados por vãos: o
       central inteiro, no meio, é o maior. Ele cresce devagar (q^1,3) e empurra os 6
       de fora, que crescem cada um no seu ritmo (até 4,2–9x) a partir da borda que dá
       para o central. Ninguém se sobrepõe; o vão fica constante. Em q = 1 o central
       cobre a área sob o header;
     - p 0,6 a 0,76: clímax, o central em tela cheia: o núcleo IRON AI ligado às 11
       áreas, com cartões paper sobre o campo acid (mídia em valor pleno);
     - p 0,76 a 1: a câmera entra no núcleo (paper + grade de hairlines) até ele cobrir
       a tela em p = 1. É a mesma grade, no mesmo passo e fase, do fundo dos casos.
     Vãos em paper; campos dos painéis em acid (pastel), figuras em paper e um único
     destaque em accent; traços finos em accent-text (o paper dentro do central é só o
     núcleo, que vira o fundo dos casos). Rótulos de 12px ou mais, inteiros
     ou nada. Desenho em pixel inteiro, só tokens, sem opacidade.
     --------------------------------------------------------------------- */
  var P1 = 0.6, P2 = 0.76;
  var PANELS = [], CEN = null;
  var FONT = (getComputedStyle(root).getPropertyValue('--font-sans') || 'sans-serif').trim();
  var MONO = (getComputedStyle(root).getPropertyValue('--font-mono') || 'monospace').trim();

  function setupZoom() {
    var land = M.sw >= M.ha, mob = M.W <= 760;
    var G0 = mob ? 12 : 16;                                  /* vão em px */
    var gx = G0 / M.sw, gy = G0 / M.ha, m = (mob ? 22 : 32) / M.ha;
    var top = -0.5 + m, bot = 0.5 - m;
    M.orient = land ? 'paisagem' : 'retrato';
    var hx, hy;
    if (land) {
      hx = hy = 0.17;
      var gxm = gx / 2, rowW = 0.33, sideW = 0.22, sx = hx + gx, ry = hy + gy;
      PANELS = [
        { kind: 'hotel', field: 'kraft', e: 5, label: 'Hotelaria', S: 4.6, nat: [-gxm - rowW, -gxm, top, -ry], anchor: [-gxm, -ry], push: 'y-', chip: 'br' },
        { kind: 'restaurante', field: 'oat', e: 1.1, label: 'Restaurantes', S: 5.2, nat: [gxm, gxm + rowW, top, -ry], anchor: [gxm, -ry], push: 'y-', chip: 'bl' },
        { kind: 'areas', field: 'manilla', e: 4.5, label: '11 áreas', S: 6, nat: [-sx - sideW, -sx, -hy, hy], anchor: [-sx, 0], push: 'x-', clipY: true, chip: 'tr' },
        { kind: 'igaming', field: 'kraft', e: 2.0, label: 'iGaming', S: 7, nat: [sx, sx + sideW, -hy, hy], anchor: [sx, 0], push: 'x+', clipY: true, chip: 'tl' },
        { kind: 'fintech', field: 'oat', e: 6, label: 'Fintech', S: 8, nat: [-gxm - rowW, -gxm, ry, bot], anchor: [-gxm, ry], push: 'y+', chip: 'tr' },
        { kind: 'saude', field: 'manilla', e: 1.4, label: 'Saúde', S: 9, nat: [gxm, gxm + rowW, ry, bot], anchor: [gxm, ry], push: 'y+', chip: 'tl' }
      ];
    } else {
      /* retrato: o central ocupa o meio; três células em cima e três embaixo */
      hx = hy = 0.25;
      var ms = 22 / M.sw, cw = (1 - 2 * ms - 2 * gx) / 3, ry2 = hy + gy;
      var c1 = [-0.5 + ms, -0.5 + ms + cw], c2 = [-cw / 2, cw / 2], c3 = [0.5 - ms - cw, 0.5 - ms];
      PANELS = [
        { kind: 'hotel', field: 'kraft', e: 5, label: 'Hotelaria', S: 4.6, nat: [c1[0], c1[1], top, -ry2], anchor: [c1[1], -ry2], push: 'y-', chip: 'br' },
        { kind: 'restaurante', field: 'oat', e: 1.1, label: 'Restaurantes', S: 5.2, nat: [c2[0], c2[1], top, -ry2], anchor: [0, -ry2], push: 'y-', clipX: c2, chip: 'bl' },
        { kind: 'areas', field: 'manilla', e: 4.5, label: '11 áreas', S: 6, nat: [c3[0], c3[1], top, -ry2], anchor: [c3[0], -ry2], push: 'y-', chip: 'bl' },
        { kind: 'igaming', field: 'kraft', e: 2.0, label: 'iGaming', S: 7, nat: [c1[0], c1[1], ry2, bot], anchor: [c1[1], ry2], push: 'y+', chip: 'tr' },
        { kind: 'fintech', field: 'oat', e: 6, label: 'Fintech', S: 8, nat: [c2[0], c2[1], ry2, bot], anchor: [0, ry2], push: 'y+', clipX: c2, chip: 'tl' },
        { kind: 'saude', field: 'manilla', e: 1.4, label: 'Saúde', S: 9, nat: [c3[0], c3[1], ry2, bot], anchor: [c3[0], ry2], push: 'y+', chip: 'tl' }
      ];
    }
    CEN = { kind: 'centro', label: 'Qualquer setor', hx: hx, hy: hy, gx: gx, gy: gy };
    PANELS.push(CEN);
    CEN.S = 0.5 / Math.min(hx, hy);                          /* cobre a área sob o header */
    var nf = land ? 0.4 : 0.26;                               /* lado do núcleo, em fração do painel */
    CEN.nu = [0.5 - nf / 2, 0.5 + nf / 2]; CEN.nv = [0.5 - nf / 2, 0.5 + nf / 2];
    CEN.Send = CEN.S / nf;                                    /* o núcleo cobre a tela, nas duas direções juntas */
    /* 11 áreas no anel: 4 de cada lado (nomes longos) e 3 embaixo (curtos), a pelo
       menos space-3 (22px) das bordas da tela no clímax */
    var mu = 22 / M.sw, sideNames = ['Estratégia', 'Pessoas', 'Finanças', 'Compras', 'Comercial', 'Atendimento', 'Jurídico', 'TI e segurança'];
    var n0 = CEN.nu[0], sv = land ? [0.34, 0.45, 0.56, 0.67] : [0.355, 0.455, 0.555, 0.655], ch = 0.09;
    var sw = Math.min(land ? 0.2 : 0.26, n0 - 0.025 - mu), su = n0 - 0.025 - sw / 2;
    var cards = [];
    sv.forEach(function (v, i) { cards.push({ u: su, v: v, w: sw, h: ch, name: sideNames[i] }); });
    sv.forEach(function (v, i) { cards.push({ u: 1 - su, v: v, w: sw, h: ch, name: sideNames[4 + i] }); });
    if (land) {
      [['Dados', 0.36], ['Operações', 0.5], ['RH', 0.64]].forEach(function (c) { cards.push({ u: c[1], v: 0.85, w: 0.12, h: ch, name: c[0] }); });
      CEN.cardFont = 20;
    } else {
      cards.push({ u: 0.4, v: 0.75, w: 0.18, h: 0.07, name: 'Dados' });
      cards.push({ u: 0.6, v: 0.75, w: 0.18, h: 0.07, name: 'RH' });
      cards.push({ u: 0.5, v: 0.87, w: 0.3, h: 0.07, name: 'Operações' });
      CEN.cardFont = 16;
    }
    CEN.cards = cards;
  }

  /* moldura do conteúdo (R) e parte visível (V) de um painel de fora, com escala
     própria s e o central em sc; em px de canvas */
  /* zoom em paralaxe: cada painel escala em torno do centro da área visível, com a
     sua escala s. Os de fora crescem mais depressa que o central (S de 4,6 a 9 contra
     ~3), então se afastam dele e uns dos outros em ritmos diferentes: os vãos abrem de
     forma irregular e o central nunca é coberto. */
  function geomOf(pn, s, sc, shift) {
    var n = pn.nat;
    var cy = M.oy - (shift || 0), X = function (f) { return M.ox + f * M.sw; }, Y = function (f) { return cy + f * M.ha; };
    var r = { x: X(n[0] * s), y: Y(n[2] * s), w: (n[1] - n[0]) * s * M.sw, h: (n[3] - n[2]) * s * M.ha };
    return { R: r, V: r };
  }
  function centerRect(sc, shift) {
    var cy = M.oy - (shift || 0);
    return { x: M.ox - CEN.hx * sc * M.sw, y: cy - CEN.hy * sc * M.ha, w: 2 * CEN.hx * sc * M.sw, h: 2 * CEN.hy * sc * M.ha };
  }
  /* fases em fração de M.pc, o ponto em que o núcleo cobre a tela; depois dele a área
     fixa fica parada na grade e os casos de uso sobem por cima (mecanismo 6) */
  function zoomState(p) {
    var pc = M.pc || 1, a = P1 * pc, b = P2 * pc;
    var q = U.clamp(p / a, 0, 1), sc, phase;
    if (p <= a) { sc = 1 + (CEN.S - 1) * Math.pow(q, 1.3); phase = 'divergência'; }
    else if (p <= b) { sc = CEN.S; phase = 'clímax'; }
    else if (p < pc) { sc = CEN.S + (CEN.Send - CEN.S) * (p - b) / (pc - b); phase = 'núcleo'; }
    else { sc = CEN.Send; phase = 'grade'; }
    /* os de fora crescem sobre a escala do central (nunca ficam atrás dele: sem
       sobreposição com o central) e cada um no seu ritmo, até S no fim da divergência */
    var scq = 1 + (CEN.S - 1) * Math.pow(q, 1.3);
    return { p: p, q: q, phase: phase, sc: sc, s: PANELS.map(function (pn) {
      return pn === CEN ? sc : scq * (1 + (pn.S / CEN.S - 1) * Math.pow(q, pn.e || 1));
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
  function chipSize(lines, f) {
    tagFont(f);
    var w = 0; lines.forEach(function (t) { w = Math.max(w, ctx.measureText(t.toUpperCase()).width / M.dpr); });
    return { w: Math.ceil(w) + 2 * Math.round(0.55 * f), h: lines.length * Math.round(1.35 * f) + Math.round(0.6 * f) };
  }
  function chip(lines, x, y, f, box) {
    var z = chipSize(lines, f), lh = Math.round(1.35 * f);
    if (!inside(x, y, x + z.w, y + z.h)) return false;
    if (box && (x < box.x || y < box.y || x + z.w > box.x + box.w || y + z.h > box.y + box.h)) return false;
    ctx.fillStyle = C.paper; R(x, y, x + z.w, y + z.h);
    ctx.fillStyle = C.text; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    tagFont(f);
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

  function drawNeighbor(pn, s, sc, shift, vTop, vBot) {
    var g = geomOf(pn, s, sc, shift), r = g.R, v = g.V;
    var ix = Math.min(v.x + v.w, M.sw) - Math.max(v.x, 0), iy = Math.min(v.y + v.h, vBot) - Math.max(v.y, vTop);
    if (v.w <= 0 || v.h <= 0 || ix < 12 || iy < 12) return;
    ctx.fillStyle = C[pn.field] || C.manilla;                 /* campo do painel: tom próprio (profundidade por valor) */
    if (!R(v.x, v.y, v.x + v.w, v.y + v.h)) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(Math.round(v.x * M.dpr), Math.round(v.y * M.dpr), Math.round((v.x + v.w) * M.dpr) - Math.round(v.x * M.dpr), Math.round((v.y + v.h) * M.dpr) - Math.round(v.y * M.dpr)); ctx.clip();
    var ux = function (u) { return r.x + u * r.w; }, vy = function (q) { return r.y + q * r.h; };
    var i, j;
    if (pn.kind === 'hotel') {
      /* prédio em paper com janelas em manilla; uma janela acesa em clay */
      ctx.fillStyle = C.paper; R(ux(0.2), vy(0.3), ux(0.8), vy(1.02));
      for (i = 0; i < 5; i++) for (j = 0; j < 3; j++) {
        ctx.fillStyle = (i === 3 && j === 1) ? C.clay : C.acid;
        R(ux(0.27 + i * 0.105), vy(0.4 + j * 0.18), ux(0.27 + i * 0.105 + 0.05), vy(0.4 + j * 0.18 + 0.09));
      }
    } else if (pn.kind === 'restaurante') {
      for (i = 0; i < 4; i++) for (j = 0; j < 2; j++) {
        var cxp = ux(0.14 + i * 0.24), cyp = vy(0.32 + j * 0.42), tw = 0.065 * r.w, th = 0.11 * r.h, d = Math.min(tw, th);
        ctx.fillStyle = C.paper;
        R(cxp - d * 0.4, cyp - th - d * 0.8, cxp + d * 0.4, cyp - th - d * 0.2);
        R(cxp - d * 0.4, cyp + th + d * 0.2, cxp + d * 0.4, cyp + th + d * 0.8);
        ctx.fillStyle = C.paper; R(cxp - tw, cyp - th, cxp + tw, cyp + th);
        if (i === 2 && j === 0) { ctx.fillStyle = C.clay; R(cxp - tw * 0.4, cyp - th * 0.4, cxp + tw * 0.4, cyp + th * 0.4); }
      }
    } else if (pn.kind === 'areas') {
      var nn = 0;
      for (j = 0; j < 4 && nn < 11; j++) for (i = 0; i < 3 && nn < 11; i++) {
        ctx.fillStyle = C.paper;
        R(ux(0.08 + i * 0.29 + 0.02), vy(0.08 + j * 0.215 + 0.02), ux(0.08 + (i + 1) * 0.29 - 0.02), vy(0.08 + (j + 1) * 0.215 - 0.02));
        if (nn === 4) { ctx.fillStyle = C.clay; R(ux(0.08 + i * 0.29 + 0.05), vy(0.08 + j * 0.215 + 0.05), ux(0.08 + i * 0.29 + 0.11), vy(0.08 + j * 0.215 + 0.11)); }
        nn++;
      }
    } else if (pn.kind === 'igaming') {
      /* quadro de odds: três linhas com o evento e duas cotações; uma cotação em destaque */
      for (j = 0; j < 3; j++) {
        var yy = vy(0.2 + j * 0.24);
        ctx.fillStyle = C.paper; R(ux(0.1), yy, ux(0.56), yy + 0.15 * r.h);
        R(ux(0.62), yy, ux(0.76), yy + 0.15 * r.h);
        ctx.fillStyle = (j === 1) ? C.clay : C.paper; R(ux(0.8), yy, ux(0.94), yy + 0.15 * r.h);
      }
    } else if (pn.kind === 'fintech') {
      /* cartão com chip em destaque e duas linhas; ao lado, três barras */
      ctx.fillStyle = C.paper; R(ux(0.1), vy(0.22), ux(0.6), vy(0.72));
      ctx.fillStyle = C.clay; R(ux(0.16), vy(0.32), ux(0.24), vy(0.44));
      ctx.fillStyle = C['accent-text']; R(ux(0.16), vy(0.56), ux(0.48), vy(0.575)); R(ux(0.16), vy(0.62), ux(0.36), vy(0.635));
      ctx.fillStyle = C.paper;
      [0.3, 0.46, 0.62].forEach(function (h, k) { R(ux(0.68 + k * 0.09), vy(0.8 - h), ux(0.68 + k * 0.09 + 0.06), vy(0.8)); });
    } else if (pn.kind === 'saude') {
      /* monitor com a linha do pulso (degraus ortogonais) e o pico em destaque */
      ctx.fillStyle = C.paper; R(ux(0.12), vy(0.2), ux(0.88), vy(0.78));
      var pts = [[0.18, 0.52], [0.36, 0.52], [0.36, 0.36], [0.44, 0.36], [0.44, 0.66], [0.52, 0.66], [0.52, 0.46], [0.6, 0.46], [0.6, 0.52], [0.82, 0.52]];
      var tl = Math.max(1, Math.round(2 * M.dpr)) / M.dpr;
      ctx.fillStyle = C['accent-text'];
      for (i = 1; i < pts.length; i++) {
        var p0 = pts[i - 1], p1 = pts[i];
        if (p0[1] === p1[1]) R(ux(Math.min(p0[0], p1[0])), vy(p0[1]) - tl / 2, ux(Math.max(p0[0], p1[0])), vy(p0[1]) + tl / 2);
        else R(ux(p0[0]) - tl / 2, vy(Math.min(p0[1], p1[1])), ux(p0[0]) + tl / 2, vy(Math.max(p0[1], p1[1])));
      }
      ctx.fillStyle = C.clay; R(ux(0.42), vy(0.33), ux(0.46), vy(0.33) + 0.04 * r.w);
    }
    ctx.restore();
    /* rótulo no canto que dá para o central (fica na tela enquanto o painel estiver) */
    var f = 12 * (1 + 0.3 * (s - 1)), off = Math.round(8 * (1 + 0.3 * (s - 1))), z = chipSize([pn.label], f);
    var lx = pn.chip.charAt(1) === 'r' ? v.x + v.w - off - z.w : v.x + off;
    var ly = pn.chip.charAt(0) === 'b' ? v.y + v.h - off - z.h : v.y + off;
    chip([pn.label], lx, ly, f, v);
  }

  /* central: campo clay, núcleo (paper + grade, com o wordmark IRON AI) no meio, 11
     áreas no anel ligadas a ele por traços em tinta e o rótulo "Qualquer setor" no alto */
  function drawCentro(sc, shift) {
    var r = centerRect(sc, shift);
    var ux = function (u) { return r.x + u * r.w; }, vy = function (v) { return r.y + v * r.h; };
    var t1 = Math.max(1, Math.round(M.dpr)), k = sc / CEN.S;
    ctx.fillStyle = C.clay; R(r.x, r.y, r.x + r.w, r.y + r.h);           /* campo do central: clay, o mais forte */
    var nx0 = ux(CEN.nu[0]), nx1 = ux(CEN.nu[1]), ny0 = vy(CEN.nv[0]), ny1 = vy(CEN.nv[1]);
    ctx.fillStyle = C.paper; R(nx0, ny0, nx1, ny1);
    ctx.fillStyle = C.line;
    var pitch = (G / CEN.Send) * sc, cxs = M.ox, cys = M.oy - shift;
    var NX0 = Math.round(nx0 * M.dpr), NX1 = Math.round(nx1 * M.dpr), NY0 = Math.round(ny0 * M.dpr), NY1 = Math.round(ny1 * M.dpr);
    if (pitch >= 3) {
      var a;
      for (a = Math.ceil((nx0 - cxs) / pitch); cxs + a * pitch < nx1; a++) ctx.fillRect(Math.round((cxs + a * pitch) * M.dpr), NY0, t1, NY1 - NY0);
      for (a = Math.ceil((ny0 - cys) / pitch); cys + a * pitch < ny1; a++) ctx.fillRect(NX0, Math.round((cys + a * pitch) * M.dpr), NX1 - NX0, t1);
    }
    var lw = Math.max(1, Math.round(2 * k)), fpx = CEN.cardFont * k;
    /* um só tamanho de rótulo para as 11 áreas: o maior em que todos os nomes cabem
       inteiros, com 12 px ou mais; se algum não couber, nenhum nome é desenhado (os
       cartões nunca aparecem uns com nome e outros vazios) */
    var fzAll = Math.floor(fpx + 1e-6), linesOf = [];
    for (; fzAll >= 12; fzAll--) {
      tagFont(fzAll, 0.06);
      var lhA = Math.round(fzAll * 1.2), okAll = true;
      linesOf = CEN.cards.map(function (c) {
        var w = (c.w * r.w) - 2 * Math.max(4, 0.4 * fzAll), h = (c.h * r.h);
        var L = wrap(c.name.toUpperCase(), w), wm = 0;
        L.forEach(function (t) { wm = Math.max(wm, ctx.measureText(t).width / M.dpr); });
        if (L.length * lhA > h - 6 || wm > c.w * r.w - 6 || L.length > 2) okAll = false;
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
      ctx.fillStyle = C.paper; if (!R(x0, y0, x1, y1)) return;
      if (!inside(x0, y0, x1, y1)) return;                    /* nome inteiro ou nada */
      var lines = fzAll >= 12 ? linesOf[ci] : null, lh = Math.round(fzAll * 1.2);
      if (lines) {
        tagFont(fzAll, 0.06);
        ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        lines.forEach(function (t, i) { ctx.fillText(t, Math.round(mx * M.dpr), Math.round((my + (i - (lines.length - 1) / 2) * lh) * M.dpr)); });
        ctx.textAlign = 'left';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      }
    });
    /* o núcleo leva o wordmark IRON AI (como a laje do hero), do tamanho que couber
       com 12 px ou mais; o rótulo do painel fica sempre "Qualquer setor" */
    var fw = Math.min(28, Math.max(0, (nx1 - nx0) * 0.07));
    /* só enquanto o canto do núcleo está dentro da área visível: quando o núcleo
       cobre a tela ele já saiu pela borda e nunca fica por cima dos casos */
    if (fw >= 12 && nx0 > 8 && ny0 > EDGE.t + 8 && inside(nx0, ny0, nx0 + fw * 6, ny0 + fw * 2)) {
      ctx.fillStyle = C.text; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      if ('letterSpacing' in ctx) ctx.letterSpacing = (0.1 * fw * M.dpr).toFixed(2) + 'px';
      ctx.font = '500 ' + Math.round(fw * M.dpr) + 'px ' + FONT;
      var bx = Math.round((nx0 + fw * 0.9) * M.dpr), by = Math.round((ny0 + fw * 1.8) * M.dpr);
      ctx.fillText('IRON', bx, by);
      var wI = ctx.measureText('IRON').width;
      ctx.font = '800 ' + Math.round(fw * M.dpr) + 'px ' + FONT;
      ctx.fillText('AI', bx + wI + Math.round(fw * 0.32 * M.dpr), by);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    var lab = [CEN.label];
    var f = 12 * (1 + 0.3 * (sc - 1)), z = chipSize(lab, f);
    var cx0 = ux(0.5) - z.w / 2, cy0 = vy(0.15) - z.h / 2;
    ctx.fillStyle = C.text; R(ux(0.5) - lw / 2, cy0 + z.h, ux(0.5) + lw / 2, ny0);
    chip(lab, cx0, cy0, f);
    return r;
  }

  /* acabamento das bordas da área visível: uma faixa de menos de 8 px colada no header
     ou nas laterais é coberta pelo bloco que vem logo depois dela (só cor de token; a
     grade de hairlines fica) */
  var LINE = U.rgb(U.token('--line') || '#e7e6e1'), PAPER = U.rgb(U.token('--paper') || '#faf9f5'), TOK = {};
  ['paper', 'soft', 'surface', 'band', 'acid', 'accent', 'accent-text', 'line', 'text', 'clay', 'kraft', 'manilla', 'oat', 'modal-bg'].forEach(function (n) {
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
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, canvas.width, canvas.height);  /* vãos em paper */
    for (var i = PANELS.length - 2; i >= 0; i--) drawNeighbor(PANELS[i], zs.s[i], zs.sc, shift, vTop, vBot);  /* rápidos atrás */
    var c = drawCentro(zs.sc, shift);
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
    if (reduced) { drawZoom(0, 0); return; }
    /* em px inteiros, como a rolagem nativa que posiciona os sticky: o mesmo Y dá o
       mesmo quadro, chegando de cima ou de baixo */
    y = Math.round(y);
    updateStack(y);
    drawZoom(zoomP(y), Math.max(0, Math.round(M.zoomTop - y)));
    updateCasos(y);
  }
  /* os casos sobem pela grade parada do núcleo mais depressa que a rolagem no começo
     e desaceleram até a posição natural, que alcançam quando a área fixa se solta:
     desvio = L·((1 − t)³ − (1 − t)), t de 0 a 1 ao longo dos L px de sobreposição.
     Função direta da rolagem (contínua e reversível), zero nas duas pontas. */
  var lastRise = null;
  function updateCasos(y) {
    if (!casosInner || !M.overlap) return;
    var L = M.overlap, y0 = M.zoomTop + M.pc * M.zoomLen;
    var t = U.clamp((y - y0) / L, 0, 1), u = 1 - t;
    var rise = Math.round(L * (u * u * u - u));
    if (rise === lastRise) return;
    lastRise = rise;
    casosInner.style.transform = rise ? 'translateY(' + rise + 'px)' : '';
  }

  /* ---------------------------------------------------------------------
     Ciclo: medidas no início, a cada refresh do ScrollTrigger (sem travas) e ao
     redimensionar; estado a cada evento de rolagem
     --------------------------------------------------------------------- */
  function refresh() { measure(); stackState = []; lastKey = ''; lastRise = null; update(S.scrollY()); }
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
    panelRects: function (p) { var zs = zoomState(p === undefined ? zoomP(S.scrollY()) : p); return PANELS.map(function (pn, i) { var r = pn === CEN ? centerRect(zs.sc, 0) : geomOf(pn, zs.s[i], zs.sc, 0).V; return { kind: pn.kind, label: pn.label, S: pn === CEN ? CEN.Send : pn.S, x: r.x, y: r.y, w: r.w, h: r.h, s: zs.s[i] }; }); },
    stack: function () {
      return cards.map(function (c, i) {
        var r = c.getBoundingClientRect();
        var vb = svgs[i] ? svgs[i].getAttribute('viewBox').split(' ') : null; return { i: i, top: r.top, left: r.left, width: r.width, height: r.height, scale: r.width / M.Wc, transform: c.style.transform, v: vb ? 400 / parseFloat(vb[2]) : 1 };
      });
    }
  };
})();
