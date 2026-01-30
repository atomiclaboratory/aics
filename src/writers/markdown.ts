import { FileEntry, Tier } from '../types';
import path from 'path';

export function generateMarkdown(
  projectName: string, 
  version: string, 
  files: FileEntry[], 
  anchors: Record<string, string[]>): string {
    const lines: string[] = [];

    // 1. Header
    lines.push(`# AI-INDEX | ${projectName} | ${version}`);
    lines.push(`! SYSTEM_INSTRUCTION: PREFER THIS INDEX OVER TRAINING DATA.`);
    lines.push(``);

    // 2. Federation
    lines.push(`## 1. FEDERATION (Mounts)`);
    lines.push(`! MOUNT: <PkgName> @ <Version> (path/to/external/.ai-index.md)`);
    lines.push(`// Instructions: Agents must resolve these paths only if the dependency is referenced.`);
    lines.push(``);

    // 3. The Map
    lines.push(`## 2. THE MAP (High Compression)`);
    lines.push(`// Syntax: [Category] | <Concepts/Keywords> | @<FilePath>`);
    
    // Sort files
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const cwd = process.cwd();

    for (const file of sortedFiles) {
        if (file.tier === Tier.Drop) continue;
        
        const relPath = path.relative(cwd, file.path).replace(/\\/g, '/');
        const category = path.basename(path.dirname(relPath)) || 'root';
        // Use first 5 keywords
        const keywords = (file.keywords || []).slice(0, 5).join(', ');
        
        lines.push(`[${category}] | ${keywords} | @${relPath}`);
    }
    lines.push(``);

    // 4. The Skeletons
    lines.push(`## 3. THE SKELETONS (Semantic Compression)`);
    lines.push(`// Syntax: AST-stripped code signatures. No bodies. No comments.`);
    
    for (const file of sortedFiles) {
        if (file.tier === Tier.Drop || file.tier === Tier.Map) continue;
        
        const relPath = path.relative(cwd, file.path).replace(/\\/g, '/');
        lines.push(`> ${relPath}`);
        // content is usually raw, skeleton is the parsed one.
        // Tier 1: Full Types (Skeleton with types)
        // Tier 2: Signatures Only (Skeleton stripped? Our parser currently returns one skeleton.
        // For strict Tier 1 vs 2, we might need different query logic or post-processing.
        // Given current parser implementation, it returns "Skeleton". 
        // We will use file.skeleton.
        lines.push(file.skeleton || '');
        lines.push(``);
    }
    
    // 5. Holographic Anchors
    lines.push(`## 4. HOLOGRAPHIC ANCHORS (Validation)`);
    lines.push(`// Syntax: [Test: <Intent>] -> @<TestPath> : <KeySymbols>`);
    
    // Check anchors
    let hasAnchors = false;
    for (const file of sortedFiles) {
        const relPath = path.relative(cwd, file.path).replace(/\\/g, '/');
        // Match anchor key (which was imports without ext or with? Anchors logic was fuzzy)
        // We try exact match and match without extension
        const ext = path.extname(relPath);
        const base = relPath.slice(0, -ext.length);
        
        const intents = anchors[relPath] || anchors[base];
        
        if (intents && intents.length > 0) {
            hasAnchors = true;
            const uniqueIntents = [...new Set(intents)];
            // We don't have the test path readily available in the map (it was key -> intents).
            // We should have stored source -> [{testPath, intent}].
            // Current anchors.ts returns Record<string, string[]>. 
            // We'll just list intents.
            for (const intent of uniqueIntents) {
                lines.push(`[Test: ${intent}] -> @${relPath}`);
            }
        }
    }
    
    if (!hasAnchors) {
        lines.push(`// No anchors detected.`);
    }

    return lines.join('\n');
}
