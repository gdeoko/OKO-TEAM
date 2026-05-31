import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                       // ОТНОСИТЕЛЬНЫЕ пути (./assets/...) — работает в любой папке хостинга
  server: { host: true, port: 5173 },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
