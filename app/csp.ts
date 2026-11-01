// The app's Content-Security-Policies, in one place for the dev server, the
// preview server and nginx (docker/app-csp.conf, docker/calculator-headers.conf).
// Those files are copies made by hand; `npm run check:csp` (CI runs it) fails
// when they differ from these.
//
// The app's pages: the bearer token lives in localStorage (docs/handoff.md
// section 6), so no script but our own may run, and no code is compiled at
// run time. Styles allow inline: MathJax writes style attributes. Images
// allow https: because practice packages link presigned R2 URLs. The Desmos
// calculator is not loaded here but in a frame of its own (calculator.html),
// hence frame-src 'self'; that frame is on the same origin, so it keeps the
// relaxed policy off these pages but doesn't wall Desmos off from storage.
export function csp({ dev }: { dev: boolean }): string {
  const script = ["'self'", ...(dev ? ["'unsafe-inline'"] : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const DESMOS = 'https://www.desmos.com https://*.desmos.com';

// The calculator frame (calculator.html): what Desmos needs to run, its
// scripts, styles, fonts, images and workers, and the code it compiles at run
// time ('unsafe-eval'). Only our own pages may frame it.
export function calculatorCsp({ dev }: { dev: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' ${DESMOS}${dev ? " 'unsafe-inline'" : ''}`,
    `style-src 'self' 'unsafe-inline' ${DESMOS}`,
    "img-src 'self' data: blob: https:",
    `font-src 'self' data: ${DESMOS}`,
    `connect-src 'self' ${DESMOS}${dev ? ' ws:' : ''}`,
    `worker-src 'self' blob: ${DESMOS}`,
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}
