import { scanDocs } from './scanner';
import { parseDocContent } from './parsers';
import { summarizeContent, LLMConfig } from '../llm/client';
import { DocFile } from '../../types';
import { logger } from '../../utils/logger';
import { CacheManager } from '../../core/cache';
import pLimit from 'p-limit';
import path from 'path';

export async function processDocs(inputDirs: string[], cache: CacheManager, llmConfig?: LLMConfig): Promise<DocFile[]> {
    const filePaths = await scanDocs(inputDirs);
    const limit = pLimit(5); // Conservative concurrency for API/Large Files
    
    const tasks = filePaths.map(filePath => limit(async () => {
        try {
            const content = await parseDocContent(filePath);
            if (!content || content.length < 50) return null; // Skip tiny/empty files

            let summary = '';
            
            // Check cache first
            const cachedSummary = cache.getDocSummary(filePath, content);
            if (cachedSummary) {
                summary = cachedSummary;
            } else if (llmConfig && llmConfig.apiKey) {
                // Only summarize if content is substantial and not cached
                logger.info(`Summarizing ${path.basename(filePath)}...`);
                const summaryText = await summarizeContent(content, llmConfig);
                if (summaryText) {
                    summary = summaryText;
                    // Cache the result
                    cache.setDocSummary(filePath, content, summary);
                }
                else summary = content.slice(0, 100).replace(/\n/g, ' ') + '...';
            } else {
                // Fallback: First 100 chars
                summary = content.slice(0, 100).replace(/\n/g, ' ') + '...';
            }

            return {
                path: filePath,
                type: path.extname(filePath).slice(1),
                summary: summary,
                tokenCount: content.length / 4 // Crude estimate
            } as DocFile;
        } catch (e: any) {
            logger.warn(`Failed to process doc ${path.basename(filePath)}: ${e.message}`);
            return null;
        }
    }));

    const results = await Promise.all(tasks);
    return results.filter((r): r is DocFile => r !== null);
}
