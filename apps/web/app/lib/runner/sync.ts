import { runnerFetch } from './client';
import type { FileMap } from '~/lib/stores/files';
import { WORK_DIR } from '~/utils/constants';

export function prepareSnapshot(files: FileMap) {
  const entries: { path: string; content: string }[] = [];
  const skipped: string[] = [];
  let bytes = 0;
  for (const [absolute, file] of Object.entries(files)) {
    if (file?.type !== 'file') continue;
    if (!absolute.startsWith(`${WORK_DIR}/`)) throw new Error('File is outside the editor workspace.');
    const path = absolute.slice(WORK_DIR.length + 1);
    const parts = path.split('/');
    if (parts.some((part) => !part || part === '..' || part === '.')) throw new Error('Invalid project file path.');
    if (file.isBinary || parts.some((part) => ['node_modules', '.git', '.venv', '__pycache__', 'dist', 'build'].includes(part)) || parts.some((part) => part.startsWith('.env') && part !== '.env.example') || /\.(pem|key|p12)$/i.test(path)) {
      skipped.push(path);
      continue;
    }
    const size = new TextEncoder().encode(file.content).length;
    if (size > 1024 * 1024) throw new Error(`${path} exceeds the runner's 1 MiB limit.`);
    bytes += size;
    entries.push({ path, content: file.content });
  }
  if (!entries.length) throw new Error('No eligible text files to sync.');
  if (entries.length > 500 || bytes > 10 * 1024 * 1024) throw new Error('Project exceeds the 500-file / 10 MiB sync limit.');
  return { entries, skipped };
}

export async function syncSnapshot(snapshot: ReturnType<typeof prepareSnapshot>, project: string, send: (input: string, init?: RequestInit) => Promise<Response> = runnerFetch) {
  if (!/^project-[a-zA-Z0-9-]+$/.test(project)) throw new Error('Invalid snapshot ID.');
  let saved = 0;
  for (const entry of snapshot.entries) {
    try {
      const response = await send(`http://127.0.0.1:8787/projects/${project}/files/${entry.path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' },
        body: JSON.stringify({ content: entry.content }), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Runner returned HTTP ${response.status}.`);
      saved++;
    } catch {
      throw new Error(`Sync stopped at ${entry.path}; ${saved}/${snapshot.entries.length} files saved in ${project}. Retry creates a new snapshot.`);
    }
  }
  return project;
}
