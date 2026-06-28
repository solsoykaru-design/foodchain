import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

const app = (process.env.VITE_APP || '').trim();

const appConfig: Record<string, { title: string; viewport: string }> = {
  guest:   { title: 'FoodChain — Доставка еды', viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
  courier: { title: 'FoodChain Курьер',         viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
  admin:   { title: 'FoodChain Admin',           viewport: 'width=device-width, initial-scale=1.0' },
  waiter:  { title: 'FoodChain — Терминал официанта', viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
  kitchen: { title: 'FoodChain — Кухня',         viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
  website: { title: 'FoodChain — Ресторан',       viewport: 'width=device-width, initial-scale=1.0' },
  kiosk:   { title: 'FoodChain — Терминал самообслуживания', viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
  techcard: { title: 'AI Техкарты', viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
  'voice-waiter': { title: 'Голосовой AI-официант', viewport: 'width=device-width, initial-scale=1.0' },
};

export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [
    react(),
    tailwindcss(),
    ...(app === 'techcard' ? [viteSingleFile()] : []),
    {
      name: 'html-transform',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          if (!app) return html;
          const cfg = appConfig[app as keyof typeof appConfig] || appConfig.guest;
          return html
            .replace(/<title>.*?<\/title>/, `<title>${cfg.title}</title>`)
            .replace(/<meta name="viewport"[^>]*\/>/, `<meta name="viewport" content="${cfg.viewport}" />`)
            .replace(/src="\/src\/(?:\w+\/)?main\.tsx"/, `src="/src/${app}/main.tsx"`);
        },
      },
    },
  ],
  build: {
    outDir: `dist-${app}`,
    chunkSizeWarningLimit: 1000000,
    ...(app === 'techcard' ? {
      cssCodeSplit: false,
      assetsInlineLimit: 100000000,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          manualChunks: undefined as any,
        },
      },
    } : {}),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      '/vosk-models': { target: 'https://alphacephei.com/vosk/models', changeOrigin: true, rewrite: (path) => path.replace(/^\/vosk-models/, '') },
      '/yastt': { target: 'https://stt.api.cloud.yandex.net', changeOrigin: true, rewrite: (path) => '/speech/v1/stt:recognize' },
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
