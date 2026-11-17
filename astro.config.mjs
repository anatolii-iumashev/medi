import tailwindcss from '@tailwindcss/vite';
import { AstroPWAIntegration } from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const repositoryBase = repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/';
const base = process.env.BASE_PATH ?? (isGitHubActions ? repositoryBase : '/');
const site = process.env.SITE_URL ?? (isGitHubActions && owner ? `https://${owner}.github.io` : 'http://localhost:4321');

export default defineConfig({
  site,
  base,
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      manifest: {
        id: base,
        name: 'Medi — спокойная медитация',
        short_name: 'Medi',
        description: 'Одна спокойная практика, доступная без сети.',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#17231f',
        theme_color: '#17231f',
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      generateSW: {
        globPatterns: ['**/*.{css,html,js,mp3,svg}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
