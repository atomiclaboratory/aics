import fs from 'fs-extra';
import { scanFiles } from './scanner';
import path from 'path';

export async function generateAnchors(cwd: string = process.cwd()): Promise<Record<string, string[]>> {
  const testFiles = await scanFiles(['**/*.test.ts', '**/*.spec.ts', '**/*_test.rs', '**/*_test.R', '**/*.test.js'], cwd);
  
  const anchorMap: Record<string, string[]> = {};

  for (const file of testFiles) {
    try {
        const content = await fs.readFile(file, 'utf8');
        
        // Extract Imports
        const imports = new Set<string>();
        // TS/JS/Py imports
        const importRegex = /from\s+['"](.+?)['"]|require\(['"](.+?)['"]\)|import\s+['"](.+?)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const imp = match[1] || match[2] || match[3];
            if (imp && imp.startsWith('.')) {
                // Resolve relative path
                const resolved = path.resolve(path.dirname(file), imp);
                // Try to handle missing extensions by just using the base path without ext for matching?
                // Or resolving canonical path.
                // We'll use the relative path from root.
                const rel = path.relative(cwd, resolved).replace(/\\/g, '/');
                imports.add(rel);
            }
        }
        
        // Extract Intent
        const intents: string[] = [];
        const intentRegex = /(describe|test|it|test_that)\s*\(\s*['"](.+?)['"]/g;
        while ((match = intentRegex.exec(content)) !== null) {
            if (match[2]) intents.push(match[2]);
        }
        
        if (intents.length === 0) continue;

        // Map
        for (const imp of imports) {
            // We map the "base" path (e.g. src/auth) to intents.
            // The pipeline will have to match this against actual files (src/auth.ts).
            if (!anchorMap[imp]) anchorMap[imp] = [];
            anchorMap[imp].push(...intents);
        }
    } catch (e) {
        // ignore read errors
    }
  }
  
  return anchorMap;
}
