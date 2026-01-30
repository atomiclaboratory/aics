import fs from 'fs-extra';
import path from 'path';
import { Config } from '../types';
import { logger } from '../utils/logger';

const DEFAULT_CONFIG: Config = {
  input: ['src'],
  output: '.ai-index.md',
  budget: 32000,
  tiers: {
    protected: ['src/core/**'],
    skeleton: ['src/styles/**', 'src/templates/**'],
  },
  secrets: {
    patterns: ['*KEY*', '*TOKEN*', 'password', 'SECRET'],
  },
};

export async function loadConfig(configPath?: string): Promise<Config> {
  const targetPath = configPath || path.resolve(process.cwd(), 'aics.config.json');
  
  if (fs.existsSync(targetPath)) {
    try {
      const userConfig = await fs.readJson(targetPath);
      // Deep merge would be better, but simple shallow override for top keys for now
      logger.info(`Loaded config from ${targetPath}`);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (e) {
      logger.error(`Failed to parse config file: ${e}`);
      return DEFAULT_CONFIG;
    }
  }

  logger.debug('Using default configuration');
  return DEFAULT_CONFIG;
}
