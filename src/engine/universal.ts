import Parser from 'web-tree-sitter';
import fs from 'fs-extra';
import path from 'path';
import { ParseResult } from '../types';
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
let isInitialized = false;

function getAssetsDir() {
    // Priority 1: ../assets (Production/Dist)
    let p = path.join(__dirname, '../assets');
    if (fs.existsSync(p)) return p;
    
    // Priority 2: ../../assets (Source/Dev)
    p = path.join(__dirname, '../../assets');
    if (fs.existsSync(p)) return p;

    // Priority 3: CWD/assets (Fallback)
    return path.join(process.cwd(), 'assets');
}

async function init() {
  if (isInitialized) return;
  try {
    const assetsDir = getAssetsDir();
    const wasmPath = path.join(assetsDir, 'tree-sitter.wasm');
    await Parser.init({
      locateFile: () => wasmPath 
    });
    isInitialized = true;
  } catch (e) {
    logger.warn(`Failed to init tree-sitter. Parsing will be disabled. Error: ${e}`);
  }
}

async function loadLanguage(langId: string): Promise<Parser.Language | null> {
  if (languages[langId]) return languages[langId];
  
  const assetsDir = getAssetsDir();
  const wasmPath = path.join(assetsDir, 'languages', `tree-sitter-${langId}.wasm`);
  
  if (!fs.existsSync(wasmPath)) {
    logger.debug(`WASM not found for ${langId} at ${wasmPath}`);
    return null;
  }

  try {
    const lang = await Parser.Language.load(wasmPath);
    languages[langId] = lang;
    return lang;
  } catch (e) {
    logger.warn(`Failed to load language ${langId}`);
    return null;
  }
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

  const assetsDir = getAssetsDir();
  const queryPath = path.join(assetsDir, 'queries', `${langId}.scm`);
  let querySource = '';
  
  if (fs.existsSync(queryPath)) {
    querySource = await fs.readFile(queryPath, 'utf8');
  }
  
  // Append universal comment ignore
  querySource += '\n(comment) @ignore';

  try {
    const query = lang.query(querySource);
    queries[langId] = query;
    return query;
  } catch (e) {
    logger.warn(`Failed to compile query for ${langId}: ${e}`);
    return null;
  }
}

export async function parseFile(filePath: string, content: string): Promise<ParseResult> {
  if (!isInitialized) await init();
  
  const ext = path.extname(filePath);
  const langId = LANG_MAP[ext];
  
  if (!langId) {
    return { skeleton: content, mapKeywords: [] }; // Fallback
  }

  const parser = await getParser(langId);
  if (!parser) {
    return { skeleton: content, mapKeywords: [] };
  }

  const tree = parser.parse(content);
  const lang = languages[langId];
  const query = await getQuery(langId, lang);

  if (!query) {
     return { skeleton: content, mapKeywords: [] };
  }

  const captures = query.captures(tree.rootNode);
  const mapKeywords: Set<string> = new Set();
  
  // Replacements list: {start, end, text}
  const replacements: {start: number; end: number; text: string}[] = [];

  for (const { name, node } of captures) {
    if (name === 'ignore') {
        replacements.push({
            start: node.startIndex,
            end: node.endIndex,
            text: node.type === 'statement_block' || node.type === 'block' ? '{}' : ''
        });
    } else if (name === 'signature' || name === 'name' || name === 'tag_name') {
        mapKeywords.add(node.text);
    }
  }

  // Sort replacements descending by start to avoid index shifting
  replacements.sort((a, b) => b.start - a.start);
  
  let skeleton = content;
  for (const { start, end, text } of replacements) {
      // Simple string splice
      skeleton = skeleton.substring(0, start) + text + skeleton.substring(end);
  }

  // Collapse multiple newlines
  skeleton = skeleton.replace(/\n\s*\n\s*\n/g, '\n\n');

  return {
    skeleton: skeleton,
    mapKeywords: Array.from(mapKeywords)
  };
}