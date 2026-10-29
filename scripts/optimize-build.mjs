import { copyFile, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, relative } from 'node:path';
import subsetFont from 'subset-font';
import { create as openFont } from 'fontkit';
import { collectCharacters, dist, filesIn, hash, root } from './build-utils.mjs';

const characters = await collectCharacters();
const files = await filesIn(dist);
const pages = files.filter((path) => path.endsWith('.html'));
const replacements = new Map();
const fonts = [];

for (const [name, weight] of [['Regular', 400], ['Bold', 700]]) {
  const sourcePath = join(root, `fonts/MiSans-${name}.woff2`);
  const original = await readFile(sourcePath);
  const originalFont = openFont(original);
  const supported = [...characters].filter((c) => originalFont.hasGlyphForCodePoint(c.codePointAt(0))).join('');
  const subset = await subsetFont(original, supported, {
    targetFormat: 'woff2',
    // Retain copyright, trademark, license text and license URL metadata.
    preserveNameIds: [0, 7, 8, 9, 13, 14]
  });
  const subsetFontFile = openFont(subset);
  for (const c of supported) {
    if (!subsetFontFile.hasGlyphForCodePoint(c.codePointAt(0))) throw new Error(`Missing ${c} in ${name} subset`);
  }
  const newPath = join(dist, '_astro/fonts', `MiSans-${name}.${hash(subset)}.woff2`);
  await mkdir(join(dist, '_astro/fonts'), { recursive: true });
  await writeFile(newPath, subset);
  const emitted = [];
  for (const path of files.filter((p) => p.endsWith('.woff2'))) {
    if ((await readFile(path)).equals(original)) emitted.push(path);
  }
  if (emitted.length !== 1) throw new Error(`Expected one emitted original ${name} font, found ${emitted.length}`);
  for (const oldPath of emitted) {
    replacements.set('/' + relative(dist, oldPath), '/' + relative(dist, newPath));
  }
  fonts.push({ weight, path: relative(dist, newPath), originalBytes: original.length, bytes: subset.length,
    glyphCharacters: [...supported].map((c) => c.codePointAt(0)),
    fallbackCharacters: [...characters].filter((c) => !originalFont.hasGlyphForCodePoint(c.codePointAt(0))).join('') });
}

// Astro currently inlines its Fonts API CSS into HTML. Fail on a changed
// output contract rather than modifying a hashed stylesheet without rehashing.
for (const path of files.filter((p) => /\.(css|js|json)$/.test(p))) {
  const content = await readFile(path, 'utf8');
  if ([...replacements.keys()].some((url) => content.includes(url))) {
    throw new Error(`Font URLs moved outside inline HTML: ${path}. Update the optimizer before deploying.`);
  }
}
for (const path of pages) {
  let content = await readFile(path, 'utf8');
  for (const [oldUrl, newUrl] of replacements) content = content.replaceAll(oldUrl, newUrl);
  await writeFile(path, content);
}
for (const oldUrl of replacements.keys()) await unlink(join(dist, oldUrl.slice(1)));
await copyFile(join(root, 'src/img/favicon.ico'), join(dist, 'favicon.ico'));
await mkdir(join(root, '.build'), { recursive: true });
await writeFile(join(root, '.build/fonts.json'), JSON.stringify({ characters: [...characters].length, fonts }, null, 2) + '\n');
console.log(`MiSans: ${fonts.reduce((n, f) => n + f.originalBytes, 0)} → ${fonts.reduce((n, f) => n + f.bytes, 0)} bytes (${[...characters].length} characters including runtime labels)`);
