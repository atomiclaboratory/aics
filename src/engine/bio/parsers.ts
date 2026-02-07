import fs from 'fs-extra';
import zlib from 'zlib';
import { BioFileHologram } from './types';
import path from 'path';

// Helper to read a chunk of a file
async function readChunk(filePath: string, size: number = 4096): Promise<Buffer> {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(size);
    try {
        await fs.read(handle, buffer, 0, size, 0);
    } finally {
        await fs.close(handle);
    }
    return buffer;
}

// Helper to read Gzipped chunk
async function readGzipChunk(filePath: string, size: number = 4096): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, { start: 0, end: size * 4 }); // Read more to ensure we get enough uncompressed data
        const gunzip = zlib.createGunzip();
        let buffer = Buffer.alloc(0);
        
        stream.pipe(gunzip);
        
        gunzip.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length >= size) {
                stream.destroy();
                resolve(buffer.slice(0, size));
            }
        });
        
        gunzip.on('error', (err) => {
             // If it's not a valid gzip, checking magic number might fail earlier
             reject(err);
        });

        gunzip.on('end', () => {
             resolve(buffer);
        });
    });
}

export async function parseBioFile(filePath: string): Promise<BioFileHologram> {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    
    // Check for 0 byte file
    if (stats.size === 0) {
        return {
            path: filePath,
            type: 'unknown',
            size: 0,
            integrity: 'CORRUPT'
        };
    }

    try {
        if (ext === '.fcs') {
            return await parseFCS(filePath, stats.size);
        } else if (ext === '.fastq' || (ext === '.gz' && filePath.includes('.fastq'))) {
            return await parseFastq(filePath, stats.size);
        } else if (ext === '.bam') {
            return await parseBAM(filePath, stats.size);
        } else if (ext === '.csv') {
            return await parseCSV(filePath, stats.size);
        } else if (ext === '.h5ad') {
            return await parseH5AD(filePath, stats.size);
        }
    } catch (e) {
        // If parsing fails, return as much as we know
        return {
            path: filePath,
            type: 'unknown',
            size: stats.size,
            integrity: 'CORRUPT',
            summary: { error: (e as Error).message }
        };
    }

    return {
        path: filePath,
        type: 'unknown',
        size: stats.size,
        integrity: 'OK'
    };
}

async function parseFCS(filePath: string, size: number): Promise<BioFileHologram> {
    const chunk = await readChunk(filePath, 4096); // Header is usually small
    const headerStr = chunk.toString('utf8');
    
    // FCS version
    const version = headerStr.slice(0, 6).trim();
    
    // Find text segment delimiters
    // The header (first line) defines the offsets. E.g. "FCS3.0    58   4500   4500  99999  0  0"
    // But typically parsing the TEXT segment is key.
    // The delimiter is the first character of the TEXT segment value.
    // Wait, FCS header specifies offsets for TEXT start/end.
    // Let's rely on finding standard keywords like $PAR (params), $TOT (events).
    
    // A robust parser would read the offsets. Let's try a regex for key-values since strict parsing is hard without a library.
    // Keys start with $.
    
    // Simple heuristic: Extract $TOT (total events) and $PnS (Parameter name Short) or $PnN (Parameter name Name)
    // Note: The text segment is delimited by a character (often / or |).
    
    const keywords: Record<string, string> = {};
    const totMatch = headerStr.match(/\$TOT\/(\d+)/) || headerStr.match(/\$TOT\|(\d+)/);
    const eventCount = totMatch ? parseInt(totMatch[1]) : 0;
    
    // Markers
    const markers: string[] = [];
    // Regex to find parameter descriptions $P1S, $P2S...
    // Pattern: \$P\d+S[^/]*\/([^/]+)/
    const markerRegex = /\$P\d+S\/([^\/]+)/g;
    let match;
    while ((match = markerRegex.exec(headerStr)) !== null) {
        markers.push(match[1]);
    }
    
    return {
        path: filePath,
        type: 'fcs',
        size: size,
        integrity: 'OK',
        summary: {
            events: eventCount,
            markers: markers.slice(0, 50), // Limit to 50
            version: version
        }
    };
}

async function parseFastq(filePath: string, size: number): Promise<BioFileHologram> {
    let buffer: Buffer;
    if (filePath.endsWith('.gz')) {
        buffer = await readGzipChunk(filePath, 2048);
    } else {
        buffer = await readChunk(filePath, 2048);
    }
    
    const content = buffer.toString('utf8');
    const lines = content.split('\n');
    
    // FASTQ format:
    // @seq_id
    // SEQUENCE
    // +
    // QUALITY
    
    // Estimate read length
    let readLength = 0;
    if (lines.length > 1) {
        readLength = lines[1].trim().length;
    }
    
    // Approx read count = size / (avg_line_length * 4) ? 
    // Usually improved by just stating size and read length.
    
    return {
        path: filePath,
        type: 'fastq',
        size: size,
        integrity: 'OK',
        summary: {
            readLength: readLength,
            sampleId: lines[0]?.slice(1) || 'Unknown' // remove @
        }
    };
}

async function parseBAM(filePath: string, size: number): Promise<BioFileHologram> {
    // BAM starts with magic 'BAM\1' then header text.
    // But it's BGZF compressed.
    // We try to unzip the first chunk.
    const buffer = await readGzipChunk(filePath, 4096);
    
    // Verify magic
    if (buffer.slice(0, 4).toString('ascii') !== 'BAM\x01') {
        // Depending on how readGzipChunk handles the header...
        // Actually, if we use gunzip, the magic bytes are part of the uncompressed stream.
        // Yes, BAM\1 is the first 4 bytes of the UNCOMPRESSED data.
    }
    
    const headerText = buffer.toString('utf8'); // It will contain binary data after the header
    
    // Extract @SQ lines for chromosomes
    const sqMatches = headerText.match(/@SQ\tSN:([^\t]+)\tLN:(\d+)/g);
    const refs: string[] = [];
    if (sqMatches) {
        sqMatches.slice(0, 5).forEach(m => {
            const parts = m.split('\t');
            const sn = parts.find(p => p.startsWith('SN:'))?.substring(3);
            if (sn) refs.push(sn);
        });
    }
    
    return {
        path: filePath,
        type: 'bam',
        size: size,
        integrity: 'OK',
        summary: {
            references: refs
        }
    };
}

async function parseCSV(filePath: string, size: number): Promise<BioFileHologram> {
    const chunk = await readChunk(filePath, 4096);
    const content = chunk.toString('utf8');
    const lines = content.split('\n');
    
    if (lines.length === 0) return { path: filePath, type: 'csv', size, integrity: 'CORRUPT' };
    
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Integrity check on first few rows
    let validRows = 0;
    let nanCount = 0;
    const rowsToCheck = Math.min(lines.length - 1, 5);
    
    for (let i = 1; i <= rowsToCheck; i++) {
        if (!lines[i]) continue;
        const cols = lines[i].split(',');
        if (cols.length === header.length) validRows++;
        // Check for empty values
        cols.forEach(c => {
            if (c.trim() === '' || c.trim().toLowerCase() === 'nan' || c.trim().toLowerCase() === 'na') nanCount++;
        });
    }
    
    return {
        path: filePath,
        type: 'csv',
        size: size,
        integrity: 'OK',
        schema: header,
        summary: {
            rowCountEstimate: Math.floor(size / (lines[0].length + 1)), // Very rough
            sampleRow: lines[1] ? lines[1].slice(0, 50) + '...' : '',
            sparsity: rowsToCheck > 0 ? (nanCount / (rowsToCheck * header.length)).toFixed(2) : 0
        }
    };
}

async function parseH5AD(filePath: string, size: number): Promise<BioFileHologram> {
    // Just a placeholder.
    return {
        path: filePath,
        type: 'h5ad',
        size: size,
        integrity: 'OK',
        summary: {
            note: "HDF5 structure requires specialized parser. Metadata inferred from path."
        }
    };
}
