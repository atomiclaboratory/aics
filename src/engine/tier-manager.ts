import { getEncoding } from 'js-tiktoken';
import { FileEntry, Config, Tier } from '../types';
import { minimatch } from 'minimatch';
import { logger } from '../utils/logger';
import path from 'path';

const enc = getEncoding('cl100k_base');

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function optimizeTiers(files: FileEntry[], config: Config) {
    let totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);
    const budget = config.budget;

    if (totalTokens <= budget) return;

    logger.info(`Budget exceeded (${totalTokens} > ${budget}). Optimizing tiers...`);

    const isProtected = (p: string) => config.tiers.protected.some(pat => minimatch(p, pat));
    const isLowPriority = (p: string) => config.tiers.skeleton.some(pat => minimatch(p, pat));

    // Sort: Low (0), Standard (1), Protected (2)
    const sortedFiles = [...files].sort((a, b) => {
        const pA = isProtected(a.path) ? 2 : (isLowPriority(a.path) ? 0 : 1);
        const pB = isProtected(b.path) ? 2 : (isLowPriority(b.path) ? 0 : 1);
        return pA - pB;
    });

    // Helper to downgrade
    const downgrade = (file: FileEntry, targetTier: Tier) => {
        if (file.tier >= targetTier) return; // Already there or lower
        
        let content = '';
        if (targetTier === Tier.Signature) content = file.skeleton || '';
        if (targetTier === Tier.Map) content = file.map || '';
        
        const newTokens = countTokens(content);
        totalTokens -= (file.tokens - newTokens);
        file.tokens = newTokens;
        file.tier = targetTier;
    };

    // Pass 1: Low Priority T1 -> T2
    for (const file of sortedFiles) {
        if (totalTokens <= budget) break;
        if (isProtected(file.path)) continue;
        if (isLowPriority(file.path) && file.tier === Tier.Full) {
            downgrade(file, Tier.Signature);
        }
    }

    // Pass 2: Standard T1 -> T2
    for (const file of sortedFiles) {
        if (totalTokens <= budget) break;
        if (isProtected(file.path)) continue;
        if (!isLowPriority(file.path) && file.tier === Tier.Full) {
            downgrade(file, Tier.Signature);
        }
    }

    // Pass 3: Low Priority T2 -> T3
    for (const file of sortedFiles) {
        if (totalTokens <= budget) break;
        if (isProtected(file.path)) continue;
        if (isLowPriority(file.path) && file.tier === Tier.Signature) {
             downgrade(file, Tier.Map);
        }
    }

    // Pass 4: Standard T2 -> T3
    for (const file of sortedFiles) {
        if (totalTokens <= budget) break;
        if (isProtected(file.path)) continue;
        if (file.tier === Tier.Signature) {
             downgrade(file, Tier.Map);
        }
    }
    
    if (totalTokens > budget) {
        logger.warn(`Still over budget by ${totalTokens - budget} tokens after optimization.`);
    } else {
        logger.success(`Optimized to ${totalTokens} tokens.`);
    }
}
