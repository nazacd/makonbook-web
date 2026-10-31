import { defineConfig } from 'vite';

// The landing page: one HTML file, its stylesheet and its script, built by
// Vite so the stylesheet and script get hashed names (cached for a year by
// docker/nginx.conf). three.js and MathJax are plain files in public/vendor
// (scripts/vendor.mjs), loaded by src/main.js once the page has shown.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: { port: 5174 },
  preview: { port: 4174 },
});
