// Writes a .gz next to every text asset in the given build directories, so
// nginx can serve them with gzip_static (no compression at request time, and
// a better ratio than on-the-fly gzip). Run after the builds; the Dockerfile
// does. Already-compressed formats (woff2, png, jpg) are left alone.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const TEXT = /\.(?:js|mjs|css|html|svg|json|txt|xml|map|webmanifest)$/;
const MIN_SIZE = 1024;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let count = 0;
for (const dir of process.argv.slice(2)) {
  for await (const file of walk(dir)) {
    if (!TEXT.test(file)) continue;
    if ((await stat(file)).size < MIN_SIZE) continue;
    await writeFile(`${file}.gz`, gzipSync(await readFile(file), { level: 9 }));
    count++;
  }
}
console.log(`precompress: ${count} files`);
