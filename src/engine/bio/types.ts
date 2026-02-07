export interface BioFileHologram {
    path: string;
    type: 'fcs' | 'fastq' | 'bam' | 'h5ad' | 'csv' | 'xlsx' | 'mcd' | 'unknown';
    size: number;
    header?: string;
    schema?: string[];
    summary?: Record<string, any>;
    integrity: 'OK' | 'MISSING' | 'CORRUPT';
    metadata?: BioMetadata;
}

export interface BioMetadata {
    [key: string]: any;
}

export interface BioStudy {
    name: string;
    manifestPath: string;
    subjectCount: number;
    assays: BioAssay[];
}

export interface BioAssay {
    name: string;
    type: string; // e.g., 'CyTOF', 'Olink', 'RNASeq'
    path: string;
    files: BioFileHologram[];
}

export interface BioCohort {
    id: string;
    subjects: string[];
}

export interface GlobalManifest {
    cohorts: BioCohort[];
    totalSubjects: number;
    modalities: string[];
}
