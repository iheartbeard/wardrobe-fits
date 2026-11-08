/*
 * Собирает одностраничную версию для артефакта Claude: стили и скрипт внутри одного HTML,
 * без погоды и service worker. Результат: dist/artifact.html.
 */
import {build} from 'esbuild';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const bundle = await build({
  entryPoints: [root('js/main.artifact.js')],
  bundle: true,
  minify: false,
  format: 'iife',
  write: false,
  target: 'es2022',
});
const script = bundle.outputFiles[0].text.replaceAll('</script', '<\\/script');

const css = (await readFile(root('css/styles.css'), 'utf8')).replace(
  /\/\* standalone:start[\s\S]*?\/\* standalone:end \*\/\n?/,
  '',
);

const page = await readFile(root('index.html'), 'utf8');
const fonts = page.match(/<link\s+rel="stylesheet"\s+href="(https:\/\/fonts\.googleapis\.com[^"]+)"/)[1];
const body = page
  .match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script[^>]*src=[^>]*><\/script>/, '')
  .trim();

const html = `<title>Гардероб</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>

${body}

<script>
${script}
</script>
`;

await mkdir(root('dist'), {recursive: true});
await writeFile(root('dist/artifact.html'), html);
console.log(`dist/artifact.html, ${(html.length / 1024).toFixed(0)} КБ`);
