import { Command } from 'commander';
import { CacheManager } from '../../core/cache';
import { scanFiles } from '../../engine/scanner';
import { loadConfig } from '../../core/config';
import fs from 'fs-extra';
import { logger } from '../../utils/logger';

export const checkCommand = new Command('check')
  .description('Verify the AI Index')
  .option('--strict', 'Fail on any drift')
  .option('--lock-only', 'Only check file hashes')
  .action(async (options) => {
    const config = await loadConfig();
    const cache = new CacheManager();
    await cache.load();
    
    logger.info('Checking index integrity...');
    const files = await scanFiles(config.input);
    let drift = false;
    
    for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        if (cache.shouldParse(file, content)) {
            logger.warn(`Drift detected in ${file}`);
            drift = true;
        }
    }
    
    if (drift) {
        logger.error('Index is out of sync.');
        if (options.strict) process.exit(1);
    } else {
        logger.success('Index is up to date.');
    }
  });
