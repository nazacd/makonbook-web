// Copies MathJax from node_modules into public/vendor (git-ignored; run before
// dev and build), the same build the landing page uses, so the app's CSP can
// stay at script-src 'self'. The file name carries the version: /vendor/ is
// cached for a year.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'public', 'vendor');
await mkdir(out, { recursive: true });
await copyFile(fileURLToPath(import.meta.resolve('mathjax/es5/tex-svg.js')), join(out, 'mathjax-3.2.2-tex-svg.js'));
