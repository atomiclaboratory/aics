export interface Config {
  input: string[];
  output: string;
  budget: number;
  maxFileSize?: number; // Bytes
  tiers: {
    protected: string[];
    skeleton: string[];
  };
  secrets: {
    patterns: string[];
  };
}

export interface LockFile {
  version: string;
  files: Record<string, string>;
}

export enum Tier {
  Full = 1,
  Signature = 2,
  Map = 3,
  Drop = 4
}

export interface FileEntry {
  path: string;
  tier: Tier;
  content: string; // The raw content
  skeleton?: string; // Tier 1 & 2
  map?: string; // Tier 3
  tokens: number;
  language: string;
  hash: string;
  keywords?: string[];
}

export interface ParseResult {
  skeleton: string;
  mapKeywords: string[];
  definitions: Definition[];
  calls: CallSite[];
}

export interface Definition {
  name: string;
  type: 'function' | 'class' | 'variable';
  file: string;
  signature: string; // The raw line (e.g. "function foo(a: string)")
  doc?: string; // JSDoc/Docstring if captured
}

export interface CallSite {
  name: string;
  args: string[]; // Literal values found
  file: string;
  line: number;
}

export interface InferredData {
  values: Set<string>; // Observed literals
  usageCount: number;
  isDeprecated: boolean;
}

