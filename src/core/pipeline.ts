import { loadConfig } from './config';
import { scanFiles } from '../engine/scanner';
import { parseFile } from '../engine/universal';
import { CacheManager } from './cache';
import { optimizeTiers, countTokens } from '../engine/tier-manager';
import { generateAnchors } from '../engine/anchors';
import { generateMarkdown } from '../writers/markdown';
import { redact } from '../engine/sanitizer';
import { Registry } from '../engine/registry';
import { FileEntry, Tier, Config } from '../types';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { SingleBar, Presets } from 'cli-progress';
import pLimit from 'p-limit';
import { isBinaryFile } from 'isbinaryfile';

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
    const registry = new Registry();
    const errors: string[] = [];

    // Parallel Processing Setup
    const limit = pLimit(16); // Process 16 files concurrently
    const progressBar = new SingleBar({
        format: 'Parsing [{bar}] {percentage}% | {value}/{total} Files | Current: {file}',
        hideCursor: true,
        clearOnComplete: false
    }, Presets.shades_classic);

    if (filePaths.length > 0) {
        progressBar.start(filePaths.length, 0, { file: 'Starting...' });
    }

    const tasks = filePaths.map(filePath => limit(async () => {
        const relPath = path.relative(process.cwd(), filePath);
        const shortName = relPath.length > 30 ? '...' + relPath.slice(-27) : relPath;

        try {
            // 1. Check file size
            const stats = await fs.stat(filePath);
            const maxBytes = config.maxFileSize || 1024 * 1024;
            if (stats.size > maxBytes) return;

            // 2. Fast Check: Binary Extensions
            const ext = path.extname(filePath).toLowerCase();
            const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.pt', '.onnx', '.bin', '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.mp4', '.mov', '.mp3', '.wav'];
            if (BINARY_EXTS.includes(ext)) return;

            // 3. Deep Check: Binary Content
            // We read just enough to check signature
            const isBinary = await isBinaryFile(filePath);
            if (isBinary) return;

            const content = await fs.readFile(filePath, 'utf8');
            
            // Always parse for generation to ensure we have the content for the index
            // In a real incremental build, we'd load the old artifact if hash matches.
            const result = await parseFile(filePath, content);
            
            let skeleton = result.skeleton;
            const keywords = result.mapKeywords;
            
            // Redact secrets
            skeleton = redact(skeleton);

            // Register Metadata for Inference
            registry.registerDefs(result.definitions);
            registry.ingestCalls(result.calls);

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
        } catch (e: any) {
            errors.push(`${path.basename(filePath)}: ${e.message}`);
        } finally {
            progressBar.increment(1, { file: shortName });
        }
    }));

    await Promise.all(tasks);
    progressBar.stop();

    if (errors.length > 0) {
        logger.warn(`Finished with ${errors.length} errors:`);
        errors.slice(0, 5).forEach(e => console.log(` - ${e}`));
        if (errors.length > 5) console.log(` ... and ${errors.length - 5} more.`);
    }

    // Pass 2: Inference Enrichment (Fast, CPU bound, sequential is fine usually)
    logger.info('Running inference engine...');
    for (const file of files) {
        if (file.skeleton) {
            file.skeleton = registry.enrichSkeleton(file.skeleton);
            file.tokens = countTokens(file.skeleton);
        }
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
