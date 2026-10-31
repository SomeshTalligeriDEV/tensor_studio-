import { spawn } from 'node:child_process';
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM'); } catch {}
  }
  process.exitCode = code;
}
for (const task of ['dev', 'dev:runner']) {
  const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [task], {
    stdio: 'inherit', detached: process.platform !== 'win32',
  });
  children.push(child);
  child.on('error', error => { console.error(`Unable to start ${task}: ${error.message}`); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
