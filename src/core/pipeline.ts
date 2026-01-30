import { loadConfig } from './config';
import { scanFiles } from '../engine/scanner';
import { parseFile } from '../engine/universal';
import { CacheManager } from './cache';
import { optimizeTiers, countTokens } from '../engine/tier-manager';
import { generateAnchors } from '../engine/anchors';
import { generateMarkdown } from '../writers/markdown';
import { FileEntry, Tier } from '../types';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';

import { Config } from '../types';

export async function runPipeline(options: { 
  configPath?: string, 
  clean?: boolean, 
  dryRun?: boolean,
  verbose?: boolean,
  overrides?: Partial<Config>
}) {
    if (options.verbose) process.env.VERBOSE = 'true';

    let config = await loadConfig(options.configPath);
    if (options.overrides) {
        config = { ...config, ...options.overrides };
    }
    const cache = new CacheManager();
    
    if (options.clean) {
        cache.clean();
    } else {
        await cache.load();
    }

    logger.info('Scanning files...');
    const filePaths = await scanFiles(config.input);
    logger.info(`Found ${filePaths.length} files.`);

    const files: FileEntry[] = [];
    const anchors = await generateAnchors();

    for (const filePath of filePaths) {
        const content = await fs.readFile(filePath, 'utf8');
        const relPath = path.relative(process.cwd(), filePath);
        
        let skeleton = '';
        let keywords: string[] = [];
        
        // Always parse for generation to ensure we have the content for the index
        // In a real incremental build, we'd load the old artifact if hash matches.
        const result = await parseFile(filePath, content);
        skeleton = result.skeleton;
        keywords = result.mapKeywords;
        
        // Update cache state
        cache.shouldParse(filePath, content);

        files.push({
            path: filePath,
            tier: Tier.Full,
            content,
            skeleton,
            keywords,
            tokens: countTokens(skeleton),
            language: path.extname(filePath).slice(1),
            hash: cache.calculateHash(content)
        });
    }

    optimizeTiers(files, config);

    // Get package name from package.json if possible
    let projectName = 'Project';
    try {
        const pkg = await fs.readJson('package.json');
        projectName = pkg.name;
    } catch (e) {}

    const output = generateMarkdown(projectName, '1.0.0', files, anchors);

    if (options.dryRun) {
        logger.info('Dry run complete. Output preview (first 500 chars):');
        console.log(output.slice(0, 500) + '...');
        return;
    }

    await fs.writeFile(config.output, output);
    await cache.save();
    logger.success(`Generated ${config.output}`);
}
