import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'parse5';
import { create as openFont } from 'fontkit';
import { collectCharacters, dist, filesIn, hash, root, walkHtml } from './build-utils.mjs';

const files = await filesIn(dist);
const fileSet = new Set(files);
const manifest = JSON.parse(await readFile(join(root, '.build/fonts.json'), 'utf8'));
const characters = await collectCharacters();
const missing = new Set();
function checkUrl(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return;
  const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
  const path = resolve(dist, '.' + pathname);
  if (!fileSet.has(path) && !fileSet.has(join(path, 'index.html'))) missing.add(value);
}

for (const path of files.filter((p) => p.endsWith('.html'))) {
  const content = await readFile(path, 'utf8');
  walkHtml(parse(content), (node) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map((attr) => [attr.name, attr.value]));
    if (['img', 'script', 'source'].includes(node.tagName)) checkUrl(attrs.src);
    if (node.tagName === 'link' && /^(stylesheet|icon|preload|manifest|apple-touch-icon|sitemap)$/.test(attrs.rel)) checkUrl(attrs.href);
    if (node.tagName === 'astro-island') {
      checkUrl(attrs['component-url']);
      checkUrl(attrs['renderer-url']);
    }
    for (const candidate of (attrs.srcset ?? '').split(',')) checkUrl(candidate.trim().split(/\s/)[0]);
  });
  for (const match of content.matchAll(/url\(["']?(\/[^\s"')]+)["']?\)/g)) checkUrl(match[1]);
  assert(!/apple-touch-icon\.png|favicon-(16|32)x\1\.png|site\.webmanifest/.test(content), `Obsolete icon reference: ${path}`);
  assert(!/fonts\.(googleapis|gstatic)\.com|@vercel\/speed-insights/.test(content), `External font/analytics in ${path}`);
}
assert.equal(missing.size, 0, `Missing resources: ${[...missing].join(', ')}`);

let fontBytes = 0;
for (const record of manifest.fonts) {
  const bytes = await readFile(join(dist, record.path));
  assert(record.path.includes(hash(bytes)), 'Font content hash mismatch');
  assert.equal(bytes.length, record.bytes);
  const font = openFont(bytes);
  const source = openFont(await readFile(join(root, `fonts/MiSans-${record.weight === 400 ? 'Regular' : 'Bold'}.woff2`)));
  for (const c of characters) {
    const point = c.codePointAt(0);
    if (source.hasGlyphForCodePoint(point)) assert(font.hasGlyphForCodePoint(point), `Missing font glyph U+${point.toString(16)}`);
  }
  fontBytes += bytes.length;
}
assert(fontBytes <= 600 * 1024, `Font budget exceeded: ${fontBytes} bytes; review character growth`);
assert.equal(files.filter((p) => p.endsWith('.woff2')).length, 2, 'Unexpected full or duplicate fonts');
assert((await readFile(join(dist, 'favicon.ico'))).equals(await readFile(join(root, 'src/img/favicon.ico'))));
const icons = files.filter((p) => /xiaoyuzhou.*\.webp$/.test(p));
assert.equal(icons.length, 1);
assert((await stat(icons[0])).size < 10 * 1024, 'Platform icon exceeds 10 KiB');
for (const route of ['index.html', 'about/index.html', 'contact/index.html', '404.html', 'sitemap-index.xml', 'sitemap-0.xml', 'robots.txt', 'index.html.md', 'api/episodes/search.json', 'api/episodes/1.json', '_headers', '_redirects']) {
  assert(fileSet.has(join(dist, route)), `Missing required output ${route}`);
}
assert(!files.some((p) => /(?:^|\/)(?:_worker\.js|functions)(?:\/|$)/.test(p)), 'Expected static output');
const redirects = await readFile(join(dist, '_redirects'), 'utf8');
assert(redirects.includes('/feed/audio.xml https://feed.turbulentinsights.com/feed.xml 301'));
const homepage = await readFile(join(dist, 'index.html'), 'utf8');
assert(homepage.includes('https://turbulentinsights.com/'));
const search = JSON.parse(await readFile(join(dist, 'api/episodes/search.json'), 'utf8'));
assert(search.length > 0);
for (const episode of search) {
  assert(fileSet.has(join(dist, episode.episodeSlug, 'index.html')), `Missing episode ${episode.episodeSlug}`);
}
const sizes = await Promise.all(files.map(async (path) => ({ path: relative(dist, path), bytes: (await stat(path)).size })));
assert(sizes.every((file) => file.bytes < 25 * 1024 * 1024), 'Cloudflare Pages asset size limit exceeded');
assert(files.length < 20000, 'Cloudflare Pages file limit exceeded');
const report = { files: files.length, totalBytes: sizes.reduce((n, f) => n + f.bytes, 0), fontBytes,
  iconBytes: (await stat(icons[0])).size, homepageGzipBytes: gzipSync(homepage).length, episodes: search.length };
await writeFile(join(root, '.build/report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Static deployment checks passed:', JSON.stringify(report));
