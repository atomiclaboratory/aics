import { Command } from 'commander';
import { runBioPipeline } from '../../core/bio-pipeline';
import { logger } from '../../utils/logger';

export const bioCommand = new Command('bio-gen')
  .alias('biogen')
  .description('Generate Bio-Holographic Index for bioinformatics datasets')
  .option('-i, --input <path>', 'Input directory (root of the study)')
  .option('-o, --output <file>', 'Output filename', '.ai-index.md')
  .option('-v, --verbose', 'Enable detailed logging')
  .action(async (options) => {
    try {
        const input = options.input ? [options.input] : [process.cwd()];
        await runBioPipeline({
            input,
            output: options.output,
            verbose: options.verbose
        });
    } catch (e: any) {
        logger.error(`Bio-Gen failed: ${e.message}`);
        process.exit(1);
    }
  });
