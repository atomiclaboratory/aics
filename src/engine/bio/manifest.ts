import fs from 'fs-extra';
import path from 'path';
import { GlobalManifest, BioCohort } from './types';

export async function parseManifest(filePath: string): Promise<GlobalManifest> {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Assume CSV format: SubjectID, Cohort, ...
    // Or key-value pairs? The prompt mentions "Subject Graph" and "Cohorts".
    // "Study PRISM contains 50 Subjects (IDs P001-P050). Linked data available: CyTOF, RNA-Seq..."
    
    // Since I don't know the exact format of the manifest, I will infer it from headers.
    // Common headers: "SubjectID", "Study", "Cohort", "Timepoint"
    
    if (lines.length < 2) return { cohorts: [], totalSubjects: 0, modalities: [] };
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const subjectIdx = headers.findIndex(h => h.includes('subject') || h.includes('id') || h.includes('patient'));
    const cohortIdx = headers.findIndex(h => h.includes('cohort') || h.includes('study') || h.includes('group'));
    
    const cohortsMap = new Map<string, Set<string>>();
    let totalSubjects = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(',');
        const subj = subjectIdx >= 0 ? cols[subjectIdx] : `S${i}`;
        const cohort = cohortIdx >= 0 ? cols[cohortIdx] : 'Unknown';
        
        if (!cohortsMap.has(cohort)) {
            cohortsMap.set(cohort, new Set());
        }
        cohortsMap.get(cohort)?.add(subj);
        totalSubjects++;
    }
    
    const cohorts: BioCohort[] = [];
    cohortsMap.forEach((subjects, id) => {
        cohorts.push({
            id: id,
            subjects: Array.from(subjects)
        });
    });
    
    return {
        cohorts: cohorts,
        totalSubjects: totalSubjects,
        modalities: ['Inferred from directories'] // Placeholders
    };
}
