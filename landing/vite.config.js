import { defineConfig } from 'vite';

// The landing page: one HTML file, its stylesheet and its script, built by
// Vite so the stylesheet and script get hashed names (cached for a year by
// docker/nginx.conf). three.js and MathJax are plain files in public/vendor
// (scripts/vendor.mjs), loaded by src/main.js once the page has shown.
// The same policy docker/nginx.conf sends for the landing page, so the dev
// and preview servers show any violation too. Keep the two in step.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: { port: 5174, headers: { 'Content-Security-Policy': CSP } },
  preview: { port: 4174, headers: { 'Content-Security-Policy': CSP } },
});
