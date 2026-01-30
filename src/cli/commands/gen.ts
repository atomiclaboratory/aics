import { Command } from 'commander';
import { runPipeline } from '../../core/pipeline';
import { loadConfig } from '../../core/config';
import { Config } from '../../types';
import { logger } from '../../utils/logger';
import chokidar from 'chokidar';

export const genCommand = new Command('gen')
  .alias('generate')
  .description('Generate the AI Context Sitemap')
  .option('-c, --config <path>', 'Path to config')
  .option('-i, --input <glob>', 'Override input directory')
  .option('-o, --output <file>', 'Output filename')
  .option('-b, --budget <int>', 'Hard token limit', parseInt)
  .option('--dry-run', 'Run pipeline without writing')
  .option('--clean', 'Ignore lockfile and force re-parse')
  .option('-v, --verbose', 'Enable detailed logging')
  .option('--watch', 'Watch Mode (Development)')
  .action(async (options) => {
    const overrides: Partial<Config> = {};
    if (options.input) overrides.input = [options.input];
    if (options.output) overrides.output = options.output;
    if (options.budget) overrides.budget = options.budget;

    const pipelineOptions = {
      configPath: options.config,
      clean: options.clean,
      dryRun: options.dryRun,
      verbose: options.verbose,
      overrides
    };

    if (options.watch) {
      // Load config to determine what to watch
      let config = await loadConfig(options.config);
      if (pipelineOptions.overrides) {
        config = { ...config, ...pipelineOptions.overrides };
      }

      logger.info(`Starting Watch Mode...`);
      logger.info(`Watching: ${config.input.join(', ')}`);

      // Initial Run
      await runPipeline(pipelineOptions);
      logger.info('Waiting for changes...');

      let isRunning = false;
      let timer: NodeJS.Timeout;

      const run = async () => {
        if (isRunning) return;
        isRunning = true;
        
        logger.info('File change detected. Regenerating...');
        try {
          // In watch mode, we generally want to leverage the cache, so we don't force clean unless specificially requested?
          // But usually watch mode implies we want incremental updates.
          // Note: runPipeline handles cache loading internally.
          await runPipeline(pipelineOptions);
        } catch (e: any) {
          logger.error(`Generation failed: ${e.message}`);
        } finally {
          isRunning = false;
          logger.info('Waiting for changes...');
        }
      };

      const debouncedRun = () => {
        clearTimeout(timer);
        timer = setTimeout(run, 500);
      };

      const watcher = chokidar.watch(config.input, {
        ignoreInitial: true,
        ignored: [
          '**/node_modules/**', 
          '**/.git/**', 
          config.output, 
          '.aics-lock.json'
        ],
        persistent: true
      });

      watcher.on('all', (event, path) => {
        if (options.verbose) {
          logger.debug(`Event: ${event} on ${path}`);
        }
        debouncedRun();
      });
      
      // Keep process alive
      return new Promise(() => {}); 

    } else {
      await runPipeline(pipelineOptions);
    }
  });
