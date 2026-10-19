const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('docs/index.html', 'utf8');
const headScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const navScript = fs.readFileSync('docs/app-nav.js', 'utf8');
function routes(pathname) {
  const location = { pathname };
  let base = 'https://example.test' + pathname;
  const links = ['companion', 'workbench', 'manual', 'evidence'].map(key => ({ dataset: { appRoute: key }, set href(value) { this.url = new URL(value, base).pathname; }, setAttribute() {} }));
  const document = { body: { dataset: { appPage: 'evidence' } }, createElement: () => ({}), head: { appendChild(el) { base = new URL(el.href, base).href; } }, querySelectorAll: () => links, querySelector: () => null, getElementById: () => null };
  const window = { location: { href: base, origin: 'https://example.test' }, isSecureContext: false, matchMedia: () => ({ matches: false }), addEventListener() {}, navigator: {} };
  vm.runInNewContext(headScript, { location, document });
  vm.runInNewContext(navScript, { location, document, window, navigator: window.navigator, URL });
  return { base, urls: Object.fromEntries(links.map(link => [link.dataset.appRoute, link.url])) };
}
test('clean /docs archive resolves assets and app navigation inside the archive', () => {
  const state = routes('/docs');
  assert.equal(new URL('site.js', state.base).pathname, '/docs/site.js');
  assert.equal(new URL('demo-data.json', state.base).pathname, '/docs/demo-data.json');
  assert.deepEqual(state.urls, { companion: '/docs/clinic-companion.html', workbench: '/docs/workbench.html', manual: '/docs/manual.html', evidence: '/docs/index.html' });
});
test('Pages repository prefix remains intact', () => {
  const state = routes('/healthspan-review/index.html');
  assert.equal(new URL('site.css', state.base).pathname, '/healthspan-review/site.css');
  assert.equal(state.urls.workbench, '/healthspan-review/workbench.html');
  assert.equal(state.urls.evidence, '/healthspan-review/index.html');
});
test('root clean routes open the archive under /docs', () => {
  const state = routes('/manual');
  assert.equal(state.urls.evidence, '/docs/index.html');
  assert.equal(state.urls.workbench, '/workbench.html');
});

test('installable app includes required manifest assets and never caches API requests', () => {
  const fs = require('node:fs');
  const manifest = JSON.parse(fs.readFileSync('docs/manifest.webmanifest', 'utf8'));
  const worker = fs.readFileSync('docs/service-worker.js', 'utf8');
  const routes = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './workbench.html');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  for (const icon of manifest.icons) assert.ok(fs.existsSync(`docs/${icon.src}`));
  assert.match(worker, /url\.pathname\.indexOf\("\/api\/"\) === 0/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.ok(routes.rewrites.some(route => route.source === '/service-worker.js'));
  assert.ok(routes.headers.some(header => header.source === '/service-worker.js' && header.headers.some(item => item.key === 'Service-Worker-Allowed' && item.value === '/')));
});
