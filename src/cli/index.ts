#!/usr/bin/env node
import { Command } from 'commander';
import { genCommand } from './commands/gen';
import { checkCommand } from './commands/check';
import { initCommand } from './commands/init';
import { installHookCommand } from './commands/install-hook';
import { inspectCommand } from './commands/inspect';
import { bioCommand } from './commands/bio';
import { logger } from '../utils/logger';

// Polyfills for pdf-parse (pdf.js dependency) which crashes in Node 18+ without these
if (typeof global.DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix {};
}
if (typeof global.ImageData === 'undefined') {
    (global as any).ImageData = class ImageData {};
}
if (typeof global.Path2D === 'undefined') {
    (global as any).Path2D = class Path2D {};
}

const program = new Command();

program
  .name('aics')
  .description('AI Context Sitemap Generator')
  .version('1.0.0')
  .addCommand(genCommand)
  .addCommand(bioCommand)
  .addCommand(checkCommand)
  .addCommand(initCommand)
  .addCommand(installHookCommand)
  .addCommand(inspectCommand);

program.parseAsync(process.argv).catch(e => {
    logger.error(`Fatal: ${e.message}`);
    process.exit(1);
});