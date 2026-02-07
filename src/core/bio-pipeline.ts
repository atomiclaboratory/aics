import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { scanBioFiles } from '../engine/bio/scanner';
import { parseBioFile } from '../engine/bio/parsers';
import { parseManifest } from '../engine/bio/manifest';
import { generateBioIndex } from '../writers/bio-markdown';
import { BioStudy, BioAssay, BioFileHologram, GlobalManifest, BioCohort } from '../engine/bio/types';
import pLimit from 'p-limit';
import fg from 'fast-glob';

export async function runBioPipeline(options: {
    input: string[],
    output: string,
    verbose?: boolean
}) {
    if (options.verbose) process.env.VERBOSE = 'true';
    
    logger.info('Starting Bio-Holographic Indexer...');
    
    // 1. Parse Manifest
    // Try to find manifest in input directories
    let manifestPath = '';
    for (const dir of options.input) {
        const potentialManifest = path.join(dir, '00_Global_Metadata', 'cross_study_master_key.csv'); // Heuristic based on prompt
        if (await fs.pathExists(potentialManifest)) {
            manifestPath = potentialManifest;
            break;
        }
        // Also check if manifest is passed explicitly? No, currently heuristic.
        // Or check generic "manifest.csv"
        const generic = await fg(path.join(dir, '**/*manifest*.csv').replace(/\\/g, '/'), { absolute: true });
        if (generic.length > 0) manifestPath = generic[0];
    }
    
    let manifest: GlobalManifest = { cohorts: [], totalSubjects: 0, modalities: [] };
    if (manifestPath) {
        logger.info(`Found manifest: ${manifestPath}`);
        manifest = await parseManifest(manifestPath);
    } else {
        logger.warn('No manifest found. Subject graph will be empty.');
    }

    // 2. Scan Files
    logger.info('Scanning for bioinformatics files...');
    const filePaths = await scanBioFiles(options.input);
    logger.info(`Found ${filePaths.length} files.`);
    
    // 3. Parse Files
    const limit = pLimit(16);
    const hologramTasks = filePaths.map(fp => limit(() => parseBioFile(fp)));
    const holograms = await Promise.all(hologramTasks);
    
    // 4. Group into Studies
    const studyMap = new Map<string, BioStudy>();
    
    // Helper to extract study name
    // Assumption: Input dir is root. 
    // If input is multiple dirs, we need to be careful.
    // Assume input[0] is root.
    const rootDir = options.input[0]; 
    
    for (const h of holograms) {
        const relPath = path.relative(rootDir, h.path);
        const parts = relPath.split(path.sep);
        
        // Skip files in root or unknown structure
        if (parts.length < 2) continue;
        
        const studyName = parts[0];
        // Assay is usually the second folder, or deeper?
        // Spec says: /01_PRISM_Emory_LAIV/01_CyTOF_Oxford/...
        const assayName = parts.length > 1 ? parts[1] : 'Unknown';
        
        if (!studyMap.has(studyName)) {
            studyMap.set(studyName, {
                name: studyName,
                manifestPath: '', // specific manifest?
                subjectCount: 0, // Inferred later
                assays: []
            });
        }
        
        const study = studyMap.get(studyName)!;
        let assay = study.assays.find(a => a.name === assayName);
        if (!assay) {
            assay = {
                name: assayName,
                type: detectAssayType(assayName, h.type),
                path: path.join(rootDir, studyName, assayName),
                files: []
            };
            study.assays.push(assay);
        }
        
        assay.files.push(h);
    }
    
    // Update subject counts from manifest if possible
    // "Study PRISM contains 50 Subjects"
    manifest.cohorts.forEach(c => {
         // Try to match cohort ID to study name
         // e.g. PRISM matching PRISM_Emory_LAIV
         for (const [name, study] of studyMap) {
             if (name.includes(c.id) || c.id.includes(name)) {
                 study.subjectCount = c.subjects.length;
             }
         }
    });

    const studies = Array.from(studyMap.values());
    
    // 5. Generate Markdown
    const output = generateBioIndex('BioProject', '1.0.0', manifest, studies);
    
    await fs.writeFile(options.output, output);
    logger.success(`Generated ${options.output}`);
}

function detectAssayType(name: string, fileType: string): string {
    const n = name.toLowerCase();
    if (n.includes('cytof') || fileType === 'fcs') return 'CyTOF';
    if (n.includes('olink')) return 'Olink'; // CSV
    if (n.includes('rnaseq') || fileType === 'fastq' || fileType === 'bam') return 'RNA-Seq';
    if (n.includes('scseq') || n.includes('single_cell') || fileType === 'h5ad') return 'scRNA-Seq';
    if (n.includes('virscan')) return 'VirScan';
    if (n.includes('hai') || n.includes('serology')) return 'Serology';
    return 'Unknown';
}
