import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

import { csp } from './csp.ts';

// The app at sat.makonbook.uz. In production the edge nginx sends /v1/ to the
// API and the rest here (deploy/nginx-web.conf), so page and API share one
// origin; the dev server's proxy does the same, so there is no CORS anywhere.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  const api = env.VITE_API_URL || 'https://api.makonbook.uz';
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
    server: {
      port: 5173,
      proxy: { '/v1': { target: api, changeOrigin: true } },
      // The production policy (docker/nginx.conf), with the one exception the
      // dev server needs: React Fast Refresh injects an inline script.
      headers: { 'Content-Security-Policy': csp({ dev: true }) },
    },
    preview: {
      port: 4173,
      proxy: { '/v1': { target: api, changeOrigin: true } },
      headers: { 'Content-Security-Policy': csp({ dev: false }) },
    },
  };
});
