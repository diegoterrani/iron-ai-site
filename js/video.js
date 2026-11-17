/* =========================================================================
   IRON AI — video.js
   Vídeo com capa local ("facade"). A capa vira um iframe de
   youtube-nocookie.com (o único frame-src liberado na CSP da home):
   - ao aparecer na tela (metade visível): começa sozinho, SEM som — os
     navegadores só permitem autoplay mudo; o som fica no controle do player;
   - no clique na capa: começa com som (o clique é o gesto do visitante).
   Ao sair da tela o vídeo pausa; ao voltar, retoma (comandos postMessage da
   IFrame API, com enablejsapi=1 e origin desta página).
   Volume: o player é ajustado para VOLUME (15%) assim que fica pronto. Como o
   navegador não deixa um vídeo começar com som sem um gesto do visitante
   (rolar não conta), o som liga no primeiro clique, toque ou tecla na página
   enquanto o vídeo estiver tocando — já em 15%.
   Movimento reduzido (prefers-reduced-motion) ou sem IntersectionObserver:
   nada começa sozinho, só no clique. Sem JS, a capa é um link para o YouTube.
   Segurança: id aceito só no formato do YouTube (11 caracteres
   [A-Za-z0-9_-]); URL montada com URL/searchParams; iframe por createElement
   (nada de innerHTML); postMessage só para a origem do player.
   ========================================================================= */
(function () {
  'use strict';

  var ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var ORIGIN = 'https://www.youtube-nocookie.com';
  var VOLUME = 15;   // 0-100, IFrame API setVolume
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function embedUrl(id, muted) {
    var url = new URL('/embed/' + id, ORIGIN);
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('mute', muted ? '1' : '0');
    url.searchParams.set('playsinline', '1');     // iOS: toca na página, sem tela cheia
    url.searchParams.set('rel', '0');             // sugestões só do mesmo canal
    url.searchParams.set('enablejsapi', '1');     // aceita pausar/retomar por postMessage
    url.searchParams.set('origin', window.location.origin);
    return url.toString();
  }

  function mount(box) {
    var id = box.getAttribute('data-video-id') || '';
    var cover = box.querySelector('[data-video-play]');
    if (!cover) return;
    if (!ID_RE.test(id)) {
      // id inválido: mantém o link e registra para diagnóstico, sem quebrar a página
      if (window.console) console.warn('[video] data-video-id inválido; mantendo o link');
      return;
    }

    var frame = null;
    var observer = null;
    var ready = false;        // o player respondeu ao "listening" (onReady/initialDelivery)
    var wantSound = false;    // houve gesto do visitante: tirar o mudo assim que possível

    function command(func, args) {
      if (!frame || !frame.contentWindow) return;
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), ORIGIN);
    }

    function applyAudio() {
      if (!ready) return;
      command('setVolume', [VOLUME]);
      if (wantSound) command('unMute');
    }

    // respostas do player: só da origem do YouTube e só deste iframe
    window.addEventListener('message', function (ev) {
      if (!frame || ev.origin !== ORIGIN || ev.source !== frame.contentWindow) return;
      var data;
      try { data = JSON.parse(ev.data); } catch (err) { return; }
      if (!data || typeof data.event !== 'string') return;
      if (!ready && (data.event === 'onReady' || data.event === 'initialDelivery')) {
        ready = true;
        applyAudio();
      }
    });

    // primeiro gesto na página com o player montado: liga o som (em VOLUME)
    function onGesture() {
      if (!frame || wantSound) return;
      wantSound = true;
      applyAudio();
      ['pointerdown', 'keydown'].forEach(function (t) { document.removeEventListener(t, onGesture, true); });
    }
    ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, onGesture, true); });

    function load(muted, focus) {
      if (frame) return;
      frame = document.createElement('iframe');
      frame.className = 'video-embed__frame';
      frame.src = embedUrl(id, muted);
      frame.title = 'Vídeo da IRON AI no YouTube';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      if (!muted) wantSound = true;   // clique na capa já é o gesto
      // a IFrame API só responde depois do "listening"; repete até o player responder
      frame.addEventListener('load', function () {
        var tries = 0;
        (function hello() {
          if (ready || !frame || tries++ > 20) return;
          frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: id, channel: 'widget' }), ORIGIN);
          window.setTimeout(hello, 250);
        })();
      });
      box.replaceChild(frame, cover);
      if (focus) frame.focus();
    }

    cover.addEventListener('click', function (ev) {
      // Ctrl/Cmd/Shift/Alt/botão do meio: deixa o navegador abrir o YouTube normalmente
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      load(false, true);
    });

    if (reduced || !('IntersectionObserver' in window)) return;

    var playing = false;
    observer = new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      var visible = e.isIntersecting && e.intersectionRatio >= 0.5;
      if (visible && !frame) { load(true, false); playing = true; return; }
      if (!frame) return;
      if (visible && !playing) { command('playVideo'); playing = true; }
      else if (!visible && playing) { command('pauseVideo'); playing = false; }
    }, { threshold: [0, 0.5] });
    observer.observe(box);
  }

  var boxes = document.querySelectorAll('[data-video]');
  for (var i = 0; i < boxes.length; i++) mount(boxes[i]);
})();
