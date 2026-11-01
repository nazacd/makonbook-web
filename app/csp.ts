// The app's Content-Security-Policy, in one place for the dev server, the
// preview server and docker/app-csp.conf (nginx). That file is a copy made by
// hand; `npm run check:csp` (CI runs it) fails when the two differ.
//
// The bearer token lives in localStorage (docs/handoff.md section 6), so no
// script but our own may run: 'self' and Desmos (the calculator, from M2).
// Styles allow inline: MathJax and Desmos write style attributes. Images
// allow https: because practice packages link presigned R2 URLs.
export function csp({ dev }: { dev: boolean }): string {
  const script = ["'self'", 'https://www.desmos.com', ...(dev ? ["'unsafe-inline'"] : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://www.desmos.com",
    "worker-src 'self' blob:",
    "frame-src https://www.desmos.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
