import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const source = new URL('../assets/public/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(source, dist, { recursive: true });
for (const folder of ['src/core', 'src/data', 'src/services']) {
  await mkdir(new URL(`../dist/${folder}/`, import.meta.url), { recursive: true });
  await cp(new URL(`../${folder}/`, import.meta.url), new URL(`../dist/${folder}/`, import.meta.url), { recursive: true });
}

const css = await readFile(new URL('../assets/public/assets/app.css', import.meta.url), 'utf8');
const moduleFiles = [
  '../src/core/selection.mjs',
  '../src/core/capabilities.mjs',
  '../src/core/operations.mjs',
  '../src/data/demo-data.mjs',
  '../src/services/local-repository.mjs',
  '../assets/public/assets/app.mjs'
];
let bundle = '';
for (const file of moduleFiles) {
  let sourceCode = await readFile(new URL(file, import.meta.url), 'utf8');
  sourceCode = sourceCode.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  sourceCode = sourceCode.replace(/^export\s+/gm, '');
  bundle += `\n// ---- ${file} ----\n${sourceCode}\n`;
}
const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
  <meta name="theme-color" content="#07090d" />
  <meta name="color-scheme" content="dark" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="format-detection" content="telephone=no" />
  <title>Night City Net</title>
  <style>${css}</style>
</head>
<body>
  <div id="app" aria-live="polite"></div>
  <noscript>Night City Net требует JavaScript.</noscript>
  <script type="module">${bundle.replaceAll('</script>', '<\\/script>')}</script>
</body>
</html>`;
await writeFile(new URL('../dist/index.html', import.meta.url), html, 'utf8');
await writeFile(new URL('../template_fixed.html', import.meta.url), html, 'utf8');
console.log(`Built standalone web bundle at ${path.resolve(root.pathname, 'dist')}`);
