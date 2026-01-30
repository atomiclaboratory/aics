import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';

export const installHookCommand = new Command('install-hook')
  .description('Install git hook')
  .action(async () => {
    const hooksDir = path.resolve(process.cwd(), '.git/hooks');
    if (!fs.existsSync(hooksDir)) {
        logger.error('Not a git repository or no .git/hooks directory found.');
        return;
    }
    
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    const hookContent = `#!/bin/sh\n# AICS Hook\nnpx aics check --strict\n`;
    
    if (fs.existsSync(preCommitPath)) {
        logger.warn('pre-commit hook already exists. Appending...');
        await fs.appendFile(preCommitPath, `\n# AICS Check\nnpx aics check --strict\n`);
    } else {
        await fs.writeFile(preCommitPath, hookContent);
        try {
            await fs.chmod(preCommitPath, '755');
        } catch (e) {}
    }
    logger.success('Installed pre-commit hook.');
  });

