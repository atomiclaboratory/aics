import { minimatch } from 'minimatch';

export function shouldRedact(variableName: string, patterns: string[]): boolean {
  return patterns.some(pattern => minimatch(variableName, pattern));
}

export function redact(content: string): string {
  // Placeholder for simple string redaction if needed, but AST based is preferred in caller
  return content.replace(/['"][a-zA-Z0-9-_]{20,}['"]/g, '"[REDACTED]"');
}
