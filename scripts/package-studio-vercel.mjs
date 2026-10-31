/** Package only compiled full Studio assets; never upload workspace files or .env files. */
import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const web = resolve(root, 'apps/web');
const requireWeb = createRequire(resolve(web, 'package.json'));
const requireVite = createRequire(requireWeb.resolve('vite'));
const { build } = requireVite('esbuild');
const stage = resolve(root, '.deploy/tensorstudio');
const output = resolve(stage, '.vercel/output');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'functions/studio.func'), { recursive: true });
await cp(resolve(web, 'build/client'), resolve(output, 'static'), { recursive: true, filter: source => !source.split('/').some(part => part === '.vite' || part === '.env' || part.startsWith('.env.')) });
await rm(resolve(output, 'static/.vite'), { recursive: true, force: true });
await build({
  entryPoints: [resolve(web, 'server/vercel-studio.mjs')],
  outfile: resolve(output, 'functions/studio.func/index.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  conditions: ['node'],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
await writeFile(resolve(output, 'functions/studio.func/.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', supportsResponseStreaming: true, maxDuration: 30,
}, null, 2));
await writeFile(resolve(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/assets/(.*)', headers: { 'Cache-Control': 'public,max-age=31536000,immutable' }, continue: true },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/studio' },
  ],
}, null, 2));
await writeFile(resolve(stage, 'vercel.json'), JSON.stringify({ framework: null }, null, 2));
console.log(`Prepared TensorStudio deployment at ${stage}`);
