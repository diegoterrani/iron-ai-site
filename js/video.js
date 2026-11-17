/* =========================================================================
   IRON AI — video.js
   Vídeo com capa local ("facade"): nenhum recurso do YouTube carrega antes do
   clique. No clique, a capa vira um iframe de youtube-nocookie.com (o único
   frame-src liberado na CSP da home, vercel.json). Sem JS, a capa é um link
   comum para o vídeo no YouTube.
   Segurança: o id vem de data-video-id e só é aceito no formato de id do
   YouTube (11 caracteres [A-Za-z0-9_-]); a URL é montada com URL/searchParams,
   sem concatenar HTML. O iframe é criado por createElement (nada de innerHTML).
   ========================================================================= */
(function () {
  'use strict';

  var ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var ORIGIN = 'https://www.youtube-nocookie.com';

  function embedUrl(id) {
    var url = new URL('/embed/' + id, ORIGIN);
    url.searchParams.set('autoplay', '1');   // o clique já foi a intenção de assistir
    url.searchParams.set('rel', '0');        // sugestões só do mesmo canal
    url.searchParams.set('modestbranding', '1');
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
    cover.addEventListener('click', function (ev) {
      // Ctrl/Cmd/Shift/botão do meio: deixa o navegador abrir o YouTube normalmente
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      var frame = document.createElement('iframe');
      frame.className = 'video-embed__frame';
      frame.src = embedUrl(id);
      frame.title = 'Vídeo da IRON AI no YouTube';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.loading = 'eager';
      box.replaceChild(frame, cover);
      frame.focus();
    });
  }

  var boxes = document.querySelectorAll('[data-video]');
  for (var i = 0; i < boxes.length; i++) mount(boxes[i]);
})();
