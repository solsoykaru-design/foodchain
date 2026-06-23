import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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
};

export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [
    react(),
    tailwindcss(),
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
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/messages': { target: 'http://localhost:4000', changeOrigin: true },
      '/api/notifications': { target: 'http://localhost:4000', changeOrigin: true },
      '/api/push-settings': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
