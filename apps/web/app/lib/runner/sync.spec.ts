import { describe, expect, it, vi } from 'vitest';
import { prepareSnapshot, syncSnapshot } from './sync';
const file = (content: string) => ({ type: 'file' as const, content, isBinary: false });

describe('runner snapshots', () => {
  it('preserves empty files and skips credentials and dependencies', () => {
    const snapshot = prepareSnapshot({ '/home/project/main.py': file('hello'), '/home/project/empty': file(''), '/home/project/.env': file('secret'), '/home/project/node_modules/a': file('generated') });
    expect(snapshot.entries.map((entry) => entry.path)).toEqual(['main.py', 'empty']);
    expect(snapshot.skipped).toHaveLength(2);
  });
  it('rejects workspace escapes and oversized files before sending', () => {
    expect(() => prepareSnapshot({ '/home/project/../secret': file('secret') })).toThrow('Invalid');
    expect(() => prepareSnapshot({ '/home/project/a': file('x'.repeat(1024 * 1024 + 1)) })).toThrow('1 MiB');
  });
  it('reports partial failures without sending the remaining files', async () => {
    const send = vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('', { status: 507 }));
    const snapshot = prepareSnapshot({ '/home/project/a': file('a'), '/home/project/b': file('b'), '/home/project/c': file('c') });
    await expect(syncSnapshot(snapshot, 'project-test', send)).rejects.toThrow('1/3 files saved');
    expect(send).toHaveBeenCalledTimes(2);
  });
});
