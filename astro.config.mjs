import tailwindcss from '@tailwindcss/vite';
import { AstroPWAIntegration } from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const repositoryBase = repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/';
const base = process.env.BASE_PATH ?? (isGitHubActions ? repositoryBase : '/');
const site = process.env.SITE_URL ?? (isGitHubActions && owner ? `https://${owner}.github.io` : 'http://localhost:4321');

/**
 * The browser fetches the tab icon itself, with `Sec-Fetch-Site: cross-site`, and
 * Astro's dev server refuses cross-site subresource requests. `public/favicon.svg`
 * is a published asset, not source code, so serve it ahead of that guard in dev.
 */
function devPublicFavicon() {
  return {
    name: 'medi:dev-public-favicon',
    apply: 'serve',
    configureServer(server) {
      const file = resolve('public/favicon.svg');
      const handle = (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (!pathname.endsWith('/favicon.svg')) return next();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(file));
      };
      // Astro unshifts its Sec-Fetch guard from a post hook, so insert once the
      // server is listening, after every plugin has arranged the stack.
      const install = () => server.middlewares.stack.unshift({ route: '', handle });
      if (server.httpServer?.listening) install();
      else server.httpServer?.once('listening', install);
    },
  };
}

export default defineConfig({
  site,
  base,
  output: 'static',
  vite: {
    plugins: [devPublicFavicon(), tailwindcss()],
  },
  integrations: [
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      maximumFileSizeToCacheInBytes: 24 * 1024 * 1024,
      manifest: {
        id: base,
        name: 'medi — спокойные практики',
        short_name: 'medi',
        description: 'Три спокойные практики, доступные без сети.',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        display_override: ['minimal-ui', 'standalone', 'browser'],
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
        navigateFallback: base,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
