import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { parseFile } from '../../engine/universal';
import { countTokens } from '../../engine/tier-manager';
import { logger } from '../../utils/logger';

export const inspectCommand = new Command('inspect')
  .description('Debug what the AI sees for a specific file')
  .argument('<filepath>', 'File to inspect')
  .action(async (filepath) => {
    const absPath = path.resolve(process.cwd(), filepath);
    
    if (!fs.existsSync(absPath)) {
        logger.error(`File not found: ${absPath}`);
        return;
    }

    const content = await fs.readFile(absPath, 'utf8');
    const result = await parseFile(absPath, content);
    
    console.log('--- RAW METADATA ---');
    console.log(`Path: ${filepath}`);
    console.log(`Tokens (Original): ${countTokens(content)}`);
    console.log(`Tokens (Skeleton): ${countTokens(result.skeleton)}`);
    console.log(`Keywords: ${result.mapKeywords.join(', ')}`);
    console.log('\n--- GENERATED SKELETON ---');
    console.log(result.skeleton);
    console.log('--------------------------');
  });
