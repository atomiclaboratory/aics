import { CallSite, Definition, InferredData } from '../types';
import { logger } from '../utils/logger';

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
             
             // ESCAPE NAME for Regex
             const escapedName = name.replace(/[.*+?^${}()|[\\]/g, '\\$&');
             
             // Match function/class declaration line
             const declRegex = new RegExp(`\\b(function|class)\s+${escapedName}\\b[^\\n]*`, 'g');
             
             if (declRegex.test(newContent)) {
                 newContent = newContent.replace(declRegex, (match) => match.trim() + comment);
             }
          }
      }
      return newContent;
  }
}
