import fg from 'fast-glob';

export async function scanFiles(patterns: string[], cwd: string = process.cwd()): Promise<string[]> {
  const entries = await fg(patterns, {
    cwd,
    dot: false,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.ai-index.md', '**/.aics-lock.json'],
    absolute: true
  });
  return entries;
}
