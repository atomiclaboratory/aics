import fg from 'fast-glob';
import path from 'path';

export async function scanDocs(inputDirs: string[]): Promise<string[]> {
    const patterns = inputDirs.map(dir => path.join(dir, '**/*.{pdf,docx,md}').replace(/\\/g, '/'));
    const entries = await fg(patterns, { dot: true, absolute: true, followSymbolicLinks: false });
    return entries;
}
