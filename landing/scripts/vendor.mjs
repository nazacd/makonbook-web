// Copies the page's two libraries from node_modules into public/vendor, where
// Vite serves them as they are (git-ignored; made before dev and build). The
// page used cdnjs for both; hosting them here keeps every byte on our own
// origin (one connection, our cache rules, a strict CSP). The file names
// carry the version, because /vendor/ is cached for a year.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'public', 'vendor');
await mkdir(out, { recursive: true });

const files = {
  'three-r128.min.js': 'three/build/three.min.js',
  'mathjax-3.2.2-tex-svg.js': 'mathjax/es5/tex-svg.js',
};
for (const [name, source] of Object.entries(files)) {
  await copyFile(fileURLToPath(import.meta.resolve(source)), join(out, name));
}
