import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig((config) => {
  const scanOnly = process.env.TENSORSCAN_ONLY === '1';
  const serverEnv = loadEnv(config.mode, process.cwd(), '');
  for (const key of ['CHAIN_WS', 'RUNNER_TOKEN', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL', 'CHUTES_API_KEY', 'CHUTES_MODELS', 'AI_FALLBACK_API_KEY', 'AI_FALLBACK_BASE_URL', 'AI_FALLBACK_MODEL']) {
    if (process.env[key] === undefined && serverEnv[key]) process.env[key] = serverEnv[key];
  }
  return {
    // Pre-bundle the on-demand physics dependency to avoid a dev reload on first interaction.
    optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', '@nanostores/react', 'framer-motion', 'matter-js'] },
    resolve: { dedupe: ['react', 'react-dom'] },
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer'],
      }),
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        ...(scanOnly ? {
          ignoredRouteFiles: ['**/*'],
          routes: (defineRoutes) => defineRoutes(route => {
            route('/scan', 'routes/scan.tsx', () => { route('*', 'routes/scan.$.tsx'); });
            route('/api/market', 'routes/api.market.ts');
            route('/api/chain-config', 'routes/api.chain-config.ts');
          }),
        } : { ignoredRouteFiles: ['**/*.test.*', '**/*.spec.*'] }),
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
