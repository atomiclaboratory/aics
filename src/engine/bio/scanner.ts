import fg from 'fast-glob';
import path from 'path';

export async function scanBioFiles(inputDirs: string[]): Promise<string[]> {
    const patterns = inputDirs.map(dir => path.join(dir, '**/*.{fcs,fastq,fastq.gz,bam,h5ad,csv,xlsx,mcd}').replace(/\\/g, '/'));
    const entries = await fg(patterns, { dot: true, absolute: true, followSymbolicLinks: false });
    return entries;
}
