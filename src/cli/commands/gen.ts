import { Command } from 'commander';
import { runPipeline } from '../../core/pipeline';
import { Config } from '../../types';

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
  .action(async (options) => {
    const overrides: Partial<Config> = {};
    if (options.input) overrides.input = [options.input];
    if (options.output) overrides.output = options.output;
    if (options.budget) overrides.budget = options.budget;

    await runPipeline({
      configPath: options.config,
      clean: options.clean,
      dryRun: options.dryRun,
      verbose: options.verbose,
      overrides
    });
  });
