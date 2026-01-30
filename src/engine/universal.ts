import Parser from 'web-tree-sitter';
import fs from 'fs-extra';
import path from 'path';
import { ParseResult, CallSite, Definition } from '../types';
import { logger } from '../utils/logger';

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.r': 'r',
  '.R': 'r',
  '.html': 'html',
  '.css': 'css',
};

const parsers: Record<string, Parser> = {};
const queries: Record<string, Parser.Query> = {};
const languages: Record<string, Parser.Language> = {};

// Promise caches to prevent race conditions during parallel execution
let initPromise: Promise<void> | null = null;
const languagePromises: Record<string, Promise<Parser.Language | null>> = {};
const queryPromises: Record<string, Promise<Parser.Query | null>> = {};
const warnedLanguages = new Set<string>();

function getAssetsDir() {
  let p = path.join(__dirname, '../assets');
  if (fs.existsSync(p)) return p;
  p = path.join(__dirname, '../../assets');
  if (fs.existsSync(p)) return p;
  return path.join(process.cwd(), 'assets');
}

// Helper to ensure we don't treat complex expressions (like math) as names
function isValidIdentifier(text: string): boolean {
  // Must not be empty
  if (!text) return false;
  // Must not contain spaces or newlines
  if (/\s/.test(text)) return false;
  // Must not contain complex operators usually found in math (except _, $, ., or - for css)
  // We explicitly reject strings with parentheses, brackets, or math symbols like * + /
  if (/[\(\)\[\]\{\}\*\+\=\/\>\<\!]/.test(text)) return false;
  
  return true;
}

async function init() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
      try {
        const assetsDir = getAssetsDir();
        const wasmPath = path.join(assetsDir, 'tree-sitter.wasm');
        await Parser.init({ locateFile: () => wasmPath });
      } catch (e) {
        logger.warn(`Failed to init tree-sitter: ${e}`);
      }
  })();
  return initPromise;
}

async function loadLanguage(langId: string): Promise<Parser.Language | null> {
  if (languages[langId]) return languages[langId];
  if (languagePromises[langId]) return languagePromises[langId];

  languagePromises[langId] = (async () => {
      const assetsDir = getAssetsDir();
      const wasmPath = path.join(assetsDir, 'languages', `tree-sitter-${langId}.wasm`);
      if (!fs.existsSync(wasmPath)) return null;
      try {
        const lang = await Parser.Language.load(wasmPath);
        languages[langId] = lang;
        return lang;
      } catch (e) {
        if (!warnedLanguages.has(langId)) {
            logger.warn(`Failed to load language ${langId}`);
            warnedLanguages.add(langId);
        }
        return null;
      }
  })();
  
  return languagePromises[langId];
}

async function getParser(langId: string): Promise<Parser | null> {
  if (parsers[langId]) return parsers[langId];
  
  const lang = await loadLanguage(langId);
  if (!lang) return null;
  
  const parser = new Parser();
  parser.setLanguage(lang);
  parsers[langId] = parser;
  return parser;
}

async function getQuery(langId: string, lang: Parser.Language): Promise<Parser.Query | null> {
  if (queries[langId]) return queries[langId];
  if (queryPromises[langId]) return queryPromises[langId];

  queryPromises[langId] = (async () => {
      const assetsDir = getAssetsDir();
      const queryPath = path.join(assetsDir, 'queries', `${langId}.scm`);
      let querySource = '';
      if (fs.existsSync(queryPath)) {
        querySource = await fs.readFile(queryPath, 'utf8');
      }
      
      try {
        const query = lang.query(querySource);
        queries[langId] = query;
        return query;
      } catch (e) {
        if (!warnedLanguages.has(langId + '_query')) {
            logger.warn(`Failed to compile query for ${langId}: ${e}`);
            warnedLanguages.add(langId + '_query');
        }
        return null;
      }
  })();

  return queryPromises[langId];
}

export async function parseFile(filePath: string, content: string): Promise<ParseResult> {
  await init();
  
  const ext = path.extname(filePath);
  const langId = LANG_MAP[ext];
  const emptyResult = { skeleton: content, mapKeywords: [], definitions: [], calls: [] };

  if (!langId) return emptyResult;

  const parser = await getParser(langId);
  if (!parser) return emptyResult;

  let tree;
  try {
      tree = parser.parse(content);
  } catch (e) {
      return emptyResult;
  }

  const lang = languages[langId];
  const query = await getQuery(langId, lang);

  if (!query) return emptyResult;

  const captures = query.captures(tree.rootNode);
  const mapKeywords: Set<string> = new Set();
  const replacements: {start: number; end: number; text: string}[] = [];
  
  const callsMap = new Map<number, CallSite>();
  const definitions: Definition[] = [];

  for (const { name, node } of captures) {
    if (name === 'ignore') {
        replacements.push({
            start: node.startIndex,
            end: node.endIndex,
            text: node.type === 'statement_block' || node.type === 'block' ? '{}' : ''
        });
    } else if (name === 'signature' || name === 'name' || name === 'tag_name' || name === 'maybe_definition') {
        
        // --- VALIDATION START ---
        // Ensure the captured text is actually a valid identifier
        if (!isValidIdentifier(node.text)) {
            continue;
        }

        if (name === 'maybe_definition') {
            const parentType = node.parent?.type;
            if (!['function_declaration', 'class_declaration', 'interface_declaration', 'variable_declarator'].includes(parentType || '')) {
                continue;
            }
        }
        // --- VALIDATION END ---

        mapKeywords.add(node.text);
        definitions.push({
            name: node.text,
            type: 'function',
            file: filePath,
            signature: node.parent?.text.split('\n')[0] || node.text
        });
    } else if (name === 'call_name') {
        
        // Validate call names too
        if (!isValidIdentifier(node.text)) continue;

        let callNode = node.parent;
        if (callNode) {
            if (!callsMap.has(callNode.id)) {
                callsMap.set(callNode.id, {
                    name: node.text,
                    args: [],
                    file: filePath,
                    line: node.startPosition.row + 1
                });
            } else {
                const c = callsMap.get(callNode.id)!;
                c.name = node.text;
            }
        }
    } else if (name === 'call_arg_literal') {
        const argsNode = node.parent;
        const callNode = argsNode?.parent;
        if (callNode) {
             if (!callsMap.has(callNode.id)) {
                callsMap.set(callNode.id, {
                    name: 'unknown',
                    args: [],
                    file: filePath,
                    line: node.startPosition.row + 1
                });
            }
            const c = callsMap.get(callNode.id)!;
            c.args.push(node.text.replace(/^['"]|['"]$/g, ''));
        }
    }
  }

  // Generate Skeleton using Builder Pattern (Cursor)
  replacements.sort((a, b) => a.start - b.start);
  let skeleton = '';
  let cursor = 0;
  
  for (const { start, end, text } of replacements) {
      if (start < cursor) continue; // Skip overlaps
      skeleton += content.substring(cursor, start);
      skeleton += text;
      cursor = end;
  }
  skeleton += content.substring(cursor);
  
  // Collapse multiple newlines
  skeleton = skeleton.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Structural Minification
  const MINIFY_SAFE = ['typescript', 'javascript', 'rust', 'css', 'html'];
  if (MINIFY_SAFE.includes(langId)) {
      skeleton = skeleton
        .replace(/\s+/g, ' ')
        .replace(/\s*([\{\};,\(\):])\s*/g, '$1')
        .trim();
  } else {
      skeleton = skeleton.replace(/[ \t]+$/gm, '');
      skeleton = skeleton.replace(/\n{3,}/g, '\n\n');
  }

  return {
    skeleton,
    mapKeywords: Array.from(mapKeywords),
    definitions,
    calls: Array.from(callsMap.values())
  };
}