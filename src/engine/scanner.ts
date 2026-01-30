import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';
import { logger } from '../utils/logger';

export async function scanFiles(patterns: string[], cwd: string = process.cwd()): Promise<string[]> {
  // 1. Read .gitignore
  const ig = ignore();
  const gitIgnorePath = path.join(cwd, '.gitignore');
  
  if (fs.existsSync(gitIgnorePath)) {
      try {
          const gitignoreContent = await fs.readFile(gitIgnorePath, 'utf8');
          ig.add(gitignoreContent);
      } catch (e) {
          logger.warn(`Failed to read .gitignore: ${e}`);
      }
  }

  // 2. Add default ignores (ensure these are always ignored)
  ig.add(['.git', 'node_modules', 'dist', '.ai-index.md', '.aics-lock.json']);

  // 3. Scan
  // We give fast-glob basic ignores to avoid traversing huge dirs, 
  // but rely on 'ignore' package for accurate gitignore compliance.
  const fgIgnores = ['**/node_modules/**', '**/.git/**', '**/dist/**'];

  const entries = await fg(patterns, {
    cwd,
    dot: true, 
    ignore: fgIgnores,
    absolute: true
  });

  // 4. Filter
  const filtered = entries.filter(filePath => {
      const relPath = path.relative(cwd, filePath);
      return !ig.ignores(relPath);
  });

  return filtered;
}
