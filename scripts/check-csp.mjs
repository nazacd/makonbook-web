// The nginx headers must carry exactly the policies app/csp.ts builds for
// production: docker/app-csp.conf the app's, docker/calculator-headers.conf
// the calculator frame's. Fails when someone changed one side and not the other.
import { readFile } from 'node:fs/promises';

import { calculatorCsp, csp } from '../app/csp.ts';

const checks = [
  ['docker/app-csp.conf', csp({ dev: false })],
  ['docker/calculator-headers.conf', calculatorCsp({ dev: false })],
];
let failed = false;
for (const [file, want] of checks) {
  const conf = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (!conf.includes(`add_header Content-Security-Policy "${want}" always;`)) {
    console.error(`${file} does not match app/csp.ts. Expected:\n${want}\n`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('check-csp: docker/app-csp.conf and docker/calculator-headers.conf match app/csp.ts');
