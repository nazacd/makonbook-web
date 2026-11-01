// docker/app-csp.conf must carry exactly the policy app/csp.ts builds for
// production; this fails when someone changed one and not the other.
import { readFile } from 'node:fs/promises';

import { csp } from '../app/csp.ts';

const conf = await readFile(new URL('../docker/app-csp.conf', import.meta.url), 'utf8');
const want = csp({ dev: false });
if (!conf.includes(`add_header Content-Security-Policy "${want}" always;`)) {
  console.error('docker/app-csp.conf does not match app/csp.ts. Expected:\n' + want);
  process.exit(1);
}
console.log('check-csp: docker/app-csp.conf matches app/csp.ts');
