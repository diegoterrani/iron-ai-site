/* CSP por página (vercel.json) e regras de segurança do vídeo da home.
   node --test, sem dependências. As fontes do vercel.json usadas aqui são
   expressões que valem igual em JS (grupos, alternância e lookahead). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const pages = readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html'));
const paths = ['/', ...pages.map((f) => `/${f}`)];

const cspRules = vercel.headers.filter((h) => h.headers.some((x) => x.key === 'Content-Security-Policy'));
const cspFor = (path) => {
  const hits = cspRules.filter((r) => new RegExp(`^${r.source}$`).test(path));
  assert.equal(hits.length, 1, `${path} casa com ${hits.length} regras de CSP (esperado 1)`);
  return hits[0].headers.find((x) => x.key === 'Content-Security-Policy').value;
};
const directive = (csp, name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));

test('toda página (e a raiz) recebe exatamente uma CSP', () => {
  for (const p of paths) cspFor(p);
});

test('só a home libera frame do YouTube, e só no domínio sem cookies', () => {
  for (const p of ['/', '/index.html']) {
    assert.equal(directive(cspFor(p), 'frame-src'), 'frame-src https://www.youtube-nocookie.com');
  }
  for (const p of paths.filter((x) => x !== '/' && x !== '/index.html')) {
    assert.doesNotMatch(cspFor(p), /youtube/, `${p} não deve liberar YouTube`);
  }
});

test('nenhuma CSP afrouxa script/style nem permite ser emoldurada', () => {
  for (const p of paths) {
    const csp = cspFor(p);
    assert.doesNotMatch(csp, /unsafe-/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
  }
});

test('vídeo da home: capa com link para o YouTube e id válido, sem style inline', () => {
  const html = read('index.html');
  const m = html.match(/data-video-id="([^"]+)"/);
  assert.ok(m, 'data-video-id ausente');
  assert.match(m[1], /^[A-Za-z0-9_-]{11}$/);
  assert.ok(html.includes(`href="https://www.youtube.com/watch?v=${m[1]}"`), 'link de fallback ausente');
  assert.match(html, /rel="noopener noreferrer"/);
  assert.ok(html.includes('<script src="js/video.js" defer></script>'));
  assert.doesNotMatch(html, /\sstyle=/);
});

test('video.js monta o iframe sem innerHTML e só no domínio sem cookies', () => {
  const js = read('js/video.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(js, /https:\/\/www\.youtube-nocookie\.com/);
  assert.doesNotMatch(js, /https:\/\/www\.youtube\.com/);
});

test('a CSP do <meta> de cada página tem o mesmo frame-src do header (as duas valem juntas)', () => {
  for (const f of pages) {
    const meta = read(f).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    if (!meta) continue;
    const header = cspFor(f === 'index.html' ? '/' : `/${f}`);
    assert.equal(directive(meta[1], 'frame-src'), directive(header, 'frame-src'), `frame-src divergente em ${f}`);
  }
});

test('autoplay do vídeo: só mudo, respeita movimento reduzido e só fala com a origem do player', () => {
  const js = read('js/video.js');
  assert.match(js, /searchParams\.set\('mute', muted \? '1' : '0'\)/);
  assert.match(js, /load\(true, false\)/, 'ao aparecer na tela o player entra mudo');
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /if \(reduced \|\| !\('IntersectionObserver' in window\)\) return;/);
  assert.match(js, /postMessage\([^)]*\), ORIGIN\)/, 'postMessage sem "*"');
});
