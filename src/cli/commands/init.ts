import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';

export const initCommand = new Command('init')
  .description('Initialize aics configuration')
  .action(async () => {
    const configPath = path.resolve(process.cwd(), 'aics.config.json');
    if (fs.existsSync(configPath)) {
        logger.warn('Config already exists.');
        return;
    }
    
    const defaultConfig = {
      input: ["**/*"],
      output: ".ai-index.md",
      budget: 32000,
      tiers: {
        protected: ["core/**", "src/core/**"], // Examples
        skeleton: ["test/**", "tests/**", "**/*.test.*"]
      },
      secrets: {
        patterns: ["*KEY*", "*TOKEN*", "password", "SECRET"]
      }
    };
    
    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    logger.success('Created aics.config.json');
  });
