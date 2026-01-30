import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Config } from '../types';
import { logger } from '../utils/logger';

const DEFAULT_CONFIG: Config = {
  input: ['**/*'],
  output: '.ai-index.md',
  budget: 32000,
  maxFileSize: 1024 * 1024, // 1MB
  tiers: {
    protected: ['src/core/**'],
    skeleton: ['src/styles/**', 'src/templates/**'],
  },
  secrets: {
    patterns: ['*KEY*', '*TOKEN*', 'password', 'SECRET'],
  },
};

export async function loadConfig(configPath?: string): Promise<Config> {
  // Start with default
  let config = { ...DEFAULT_CONFIG };

  // 1. Load Global Config (~/.aics.config.json)
  const homeDir = os.homedir();
  const globalPath = path.join(homeDir, '.aics.config.json');
  
  if (fs.existsSync(globalPath)) {
    try {
      const globalConfig = await fs.readJson(globalPath);
      
      // Merge Top Level
      config = { ...config, ...globalConfig };

      // Deep Merge specific sections
      if (globalConfig.tiers) {
          config.tiers = { ...DEFAULT_CONFIG.tiers, ...globalConfig.tiers };
      }
      if (globalConfig.secrets) {
          config.secrets = { ...DEFAULT_CONFIG.secrets, ...globalConfig.secrets };
      }
      logger.debug(`Loaded global config from ${globalPath}`);
    } catch (e) {
      logger.warn(`Failed to parse global config: ${e}`);
    }
  }

  // 2. Load Local Config (Project level)
  const targetPath = configPath || path.resolve(process.cwd(), 'aics.config.json');
  
  if (fs.existsSync(targetPath)) {
    try {
      const localConfig = await fs.readJson(targetPath);
      
      // Save current state for deep merge base
      const currentTiers = { ...config.tiers };
      const currentSecrets = { ...config.secrets };

      // Merge Top Level (Local wins)
      config = { ...config, ...localConfig };

      // Deep Merge specific sections
      if (localConfig.tiers) {
         config.tiers = { ...currentTiers, ...localConfig.tiers };
      }
      if (localConfig.secrets) {
         config.secrets = { ...currentSecrets, ...localConfig.secrets };
      }
      
      logger.info(`Loaded config from ${targetPath}`);
    } catch (e) {
      logger.error(`Failed to parse config file: ${e}`);
    }
  } else if (configPath) {
      // If user explicitly asked for a config path and it's missing, error out.
      logger.error(`Config file not found: ${configPath}`);
  } else {
      logger.debug('No local config found. Using Global/Default.');
  }

  return config;
}