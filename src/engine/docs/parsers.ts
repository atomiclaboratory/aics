import fs from 'fs-extra';
import path from 'path';
import mammoth from 'mammoth';
const pdf = require('pdf-parse');

export async function parseDocContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
        if (ext === '.md' || ext === '.txt') {
            return await fs.readFile(filePath, 'utf8');
        } else if (ext === '.docx') {
            const buffer = await fs.readFile(filePath);
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (ext === '.pdf') {
            const buffer = await fs.readFile(filePath);
            const data = await pdf(buffer);
            return data.text;
        }
    } catch (e: any) {
        throw new Error(`Failed to parse ${path.basename(filePath)}: ${e.message}`);
    }
    
    return '';
}
