import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { create as openFont } from 'fontkit';
import { dist, root } from './build-utils.mjs';

// Exercise deployment failures against real generated assets. All mutations
// affect ignored build output only and are restored even when a test fails.
const check = () => spawnSync(process.execPath, ['scripts/check-build.mjs'], { cwd: root, encoding: 'utf8' });
function changeTemporarily(path, change, expected) {
  const before = readFileSync(path);
  try {
    change(before);
    const result = check();
    assert.notEqual(result.status, 0, 'A broken deployment must fail verification');
    assert.match(result.stderr, expected);
  } finally {
    writeFileSync(path, before);
  }
}

test('complete static output passes deployment verification', () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
});

test('missing favicon blocks deployment', () => {
  const path = join(dist, 'favicon.ico');
  changeTemporarily(path, () => unlinkSync(path), /Missing resources/);
});

test('new content missing from the font subset blocks deployment', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.build/fonts.json'), 'utf8'));
  const source = openFont(readFileSync(join(root, 'fonts/MiSans-Regular.woff2')));
  const subset = openFont(readFileSync(join(dist, manifest.fonts[0].path)));
  const point = source.characterSet.find((p) => p >= 0x4e00 && p <= 0x9fff && !subset.hasGlyphForCodePoint(p));
  assert(point, 'Source font must contain unused Chinese characters for this scenario');
  const path = join(dist, 'index.html');
  changeTemporarily(path, (bytes) => writeFileSync(path, bytes.toString().replace('</body>', `<p>${String.fromCodePoint(point)}</p></body>`)), /Missing font glyph/);
});

test('modified font bytes cannot reuse an immutable content hash', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.build/fonts.json'), 'utf8'));
  const path = join(dist, manifest.fonts[0].path);
  changeTemporarily(path, (bytes) => writeFileSync(path, Buffer.concat([bytes, Buffer.from([0])])), /Font content hash mismatch/);
});

test('missing referenced images block deployment', () => {
  const path = join(dist, 'index.html');
  changeTemporarily(path, (bytes) => writeFileSync(path, bytes.toString().replace('</body>', '<img src="/_astro/missing-image.webp"></body>')), /Missing resources/);
});
