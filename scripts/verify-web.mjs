import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const required = [
  'dist/index.html',
  'dist/assets/app.css',
  'dist/assets/app.mjs',
  'dist/src/core/selection.mjs',
  'dist/src/core/capabilities.mjs',
  'dist/src/core/operations.mjs'
];
for (const file of required) {
  const info = await stat(new URL(`../${file}`, import.meta.url));
  if (!info.isFile() || info.size === 0) throw new Error(`Missing or empty: ${file}`);
}
const index = await readFile(new URL('../dist/index.html', import.meta.url));
const template = await readFile(new URL('../template_fixed.html', import.meta.url));
if (!index.equals(template)) throw new Error('template_fixed.html differs from dist/index.html');
console.log(`Web integrity OK; index SHA-256 ${createHash('sha256').update(index).digest('hex')}`);
