/* Сквозная проверка: node --test tests/e2e (нужны playwright и его браузер). Обновить эталон: UPDATE_GOLDEN=1. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {takeSnapshot} from './golden-snapshot.mjs';

const PORT = 8791;
const goldenPath = fileURLToPath(new URL('./golden.json', import.meta.url));
const serverPath = fileURLToPath(new URL('../../tools/serve.mjs', import.meta.url));

test('поведение страницы совпадает с эталоном', async () => {
  const server = spawn('node', [serverPath], {env: {...process.env, PORT: String(PORT)}, stdio: 'ignore'});
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const snapshot = await takeSnapshot(`http://localhost:${PORT}/index.html`);
    if (process.env.UPDATE_GOLDEN) {
      await writeFile(goldenPath, JSON.stringify(snapshot, null, 1));
      return;
    }
    assert.deepEqual(snapshot, JSON.parse(await readFile(goldenPath, 'utf8')));
  } finally {
    server.kill();
  }
});
