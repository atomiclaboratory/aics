import { CallSite, Definition, InferredData } from '../types';
import { logger } from '../utils/logger';

// Helper to sanitize strings before passing them to new RegExp()
function escapeRegExp(string: string): string {
  // Escapes *, +, ?, (, ), etc. so they are treated as literal characters
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class Registry {
  private inferenceMap = new Map<string, InferredData>();
  private definitions: Definition[] = [];

  registerDefs(defs: Definition[]) {
    this.definitions.push(...defs);
  }

  ingestCalls(calls: CallSite[]) {
    for (const call of calls) {
      if (!this.inferenceMap.has(call.name)) {
        this.inferenceMap.set(call.name, {
          values: new Set(),
          usageCount: 0,
          isDeprecated: false
        });
      }
      
      const data = this.inferenceMap.get(call.name)!;
      data.usageCount++;
      for (const arg of call.args) {
        if (arg.length < 50) {
            data.values.add(arg);
        }
      }
    }
  }

  enrichSkeleton(content: string): string {
      let newContent = content;
      
      for (const [name, data] of this.inferenceMap.entries()) {
          if (data.values.size > 0 && data.values.size < 10) {
             const vals = Array.from(data.values).map(v => `"${v}"`).join(' | ');
             const comment = ` // @observed: ${vals}`;
             
             // 1. Sanitize the name to prevent crashes on math operators or symbols
             const safeName = escapeRegExp(name);

             // 2. Use double backslashes (\\b) for regex boundaries
             // incorrectly using \b matches a backspace character
             const declRegex = new RegExp(`(function|class)\\s+${safeName}\\b[^\\n]*`, 'g');
             
             try {
                 if (declRegex.test(newContent)) {
                     newContent = newContent.replace(declRegex, (match) => match + comment);
                 }
             } catch (e) {
                 // Gracefully skip if a name is still somehow malformed
                 logger.warn(`Skipping inference on complex identifier: ${name.substring(0, 20)}...`);
             }
          }
      }
      return newContent;
  }
}