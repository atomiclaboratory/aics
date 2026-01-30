import { Command } from 'commander';
import { genCommand } from './commands/gen';
import { checkCommand } from './commands/check';
import { initCommand } from './commands/init';
import { installHookCommand } from './commands/install-hook';
import { logger } from '../utils/logger';

const program = new Command();

program
  .name('aics')
  .description('AI Context Sitemap Generator')
  .version('1.0.0')
  .addCommand(genCommand)
  .addCommand(checkCommand)
  .addCommand(initCommand)
  .addCommand(installHookCommand);

program.parseAsync(process.argv).catch(e => {
    logger.error(`Fatal: ${e.message}`);
    process.exit(1);
});
