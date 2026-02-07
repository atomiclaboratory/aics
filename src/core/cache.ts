import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { LockFile } from '../types';
import { logger } from '../utils/logger';

const LOCK_FILE = '.aics-lock.json';

export class CacheManager {
  private lockPath: string;
  private lockData: LockFile;
  private dirty = false;

  constructor(cwd: string = process.cwd()) {
    this.lockPath = path.join(cwd, LOCK_FILE);
    this.lockData = { version: '1.0', files: {}, doc_summaries: {} };
  }

  async load() {
    if (fs.existsSync(this.lockPath)) {
      try {
        const data = await fs.readJson(this.lockPath);
        this.lockData = { ...this.lockData, ...data };
      } catch (e) {
        logger.warn('Corrupt lockfile, starting fresh.');
      }
    }
  }

  calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  shouldParse(filePath: string, content: string): boolean {
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const hash = this.calculateHash(content);
    const oldHash = this.lockData.files[relPath];

    if (hash === oldHash) {
      return false;
    }
    
    // Update hash immediately in memory (will save later)
    this.lockData.files[relPath] = hash;
    this.dirty = true;
    return true;
  }
  
  // Document Summarization Cache
  getDocSummary(filePath: string, content: string): string | null {
      const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
      const hash = this.calculateHash(content);
      const entry = this.lockData.doc_summaries?.[relPath];
      
      if (entry && entry.hash === hash) {
          return entry.summary;
      }
      return null;
  }
  
  setDocSummary(filePath: string, content: string, summary: string) {
      const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
      const hash = this.calculateHash(content);
      
      if (!this.lockData.doc_summaries) this.lockData.doc_summaries = {};
      this.lockData.doc_summaries[relPath] = { hash, summary };
      this.dirty = true;
  }

  async save() {
    if (this.dirty) {
      await fs.writeJson(this.lockPath, this.lockData, { spaces: 2 });
    }
  }
  
  clean() {
      this.lockData = { version: '1.0', files: {}, doc_summaries: {} };
      this.dirty = true;
      if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath);
  }
}
