import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseFragment } from 'parse5';
import ts from 'typescript';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dist = join(root, 'dist');
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 20);

export async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return files.flat().sort();
}

export function walkHtml(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walkHtml(child, visit);
  if (node.content) walkHtml(node.content, visit);
}

function htmlText(node) {
  if (['script', 'style'].includes(node.tagName)) return '';
  let text = node.nodeName === '#text' ? node.value : '';
  for (const attr of node.attrs ?? []) {
    if (['alt', 'title', 'placeholder', 'aria-label'].includes(attr.name)) text += attr.value;
  }
  for (const child of node.childNodes ?? []) text += htmlText(child);
  if (node.content) text += htmlText(node.content);
  return text;
}

function jsonText(value) {
  if (typeof value === 'string') return value + htmlText(parseFragment(value));
  if (Array.isArray(value)) return value.map(jsonText).join('');
  if (value && typeof value === 'object') return Object.values(value).map(jsonText).join('');
  return '';
}

// Collect runtime labels from TSX too: closed dialogs and player controls are
// absent from the initial HTML. ASCII also covers dynamic times and counters.
export async function collectCharacters() {
  let text = Array.from({ length: 95 }, (_, i) => String.fromCodePoint(i + 32)).join('');
  for (const path of await filesIn(dist)) {
    if (path.endsWith('.html')) text += htmlText(parse(await readFile(path, 'utf8')));
    if (path.endsWith('.json')) text += jsonText(JSON.parse(await readFile(path, 'utf8')));
  }
  const sourceDirs = [join(root, 'src'), join(root, 'node_modules/starpod/src/components')];
  for (const directory of sourceDirs) {
    for (const path of await filesIn(directory)) {
      if (!path.endsWith('.tsx')) continue;
      const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node) => {
        if (ts.isStringLiteralLike(node) || ts.isJsxText(node) ||
            node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateTail ||
            node.kind === ts.SyntaxKind.TemplateMiddle) text += node.text;
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return [...new Set([...text].filter((c) => !/\p{Cc}/u.test(c)))].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
