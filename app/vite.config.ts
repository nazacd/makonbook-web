import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { Connect } from 'vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { calculatorCsp, csp } from './csp.ts';

// The policies nginx sends (docker/app-csp.conf, calculator-headers.conf), on
// the dev and preview servers too: the calculator frame gets its own.
function policies(): Plugin {
  const headers =
    (dev: boolean): Connect.NextHandleFunction =>
    (req, res, next) => {
      const calculator = req.url?.split('?')[0] === '/calculator.html';
      res.setHeader('Content-Security-Policy', calculator ? calculatorCsp({ dev }) : csp({ dev }));
      res.setHeader('X-Frame-Options', calculator ? 'SAMEORIGIN' : 'DENY');
      next();
    };
  return {
    name: 'makonbook-policies',
    configureServer: (server) => void server.middlewares.use(headers(true)),
    configurePreviewServer: (server) => void server.middlewares.use(headers(false)),
  };
}

// The app at sat.makonbook.uz. In production the edge nginx sends /v1/ to the
// API and the rest here (deploy/nginx-web.conf), so page and API share one
// origin; the dev server's proxy does the same, so there is no CORS anywhere.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  const api = env.VITE_API_URL || 'https://api.makonbook.uz';
  return {
    plugins: [react(), tailwindcss(), policies()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      // The app, and the calculator's frame (calculator.html).
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          calculator: fileURLToPath(new URL('./calculator.html', import.meta.url)),
        },
      },
    },
    server: {
      port: 5173,
      // The policies come from policies() above; on the dev server they allow
      // the inline script React Fast Refresh injects.
      proxy: { '/v1': { target: api, changeOrigin: true } },
    },
    preview: {
      port: 4173,
      proxy: { '/v1': { target: api, changeOrigin: true } },
    },
  };
});
