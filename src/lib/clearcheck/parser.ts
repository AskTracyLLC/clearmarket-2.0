import * as XLSX from 'xlsx';
import type { ClearCheckImportType } from './types';

export interface ParsedRow {
    [key: string]: string | number | null;
}

export interface ParseResult {
    rows: ParsedRow[];
    errors: string[];
    warnings: string[];
}

const REQUIRED_COLUMNS = {
    EZ: ['Job ID', 'Street Addr', 'City', 'State', 'County', 'Created', 'Due', 'Rep', 'Client'],
    IA: ['Job ID', 'Street Addr', 'City', 'State', 'County', 'Created', 'Due', 'Rep', 'Source'], // IA uses "Source" instead of "Client"
};

export async function parseImportFile(
    file: File,
    importType: ClearCheckImportType
): Promise<ParseResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let rows: ParsedRow[] = [];

    try {
        const system = importType.startsWith('EZ') ? 'EZ' : 'IA';
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null
        }) as any[][];

        if (jsonData.length < 2) {
            errors.push('File must contain at least a header row and one data row.');
            return { rows, errors, warnings };
        }

        const headers = jsonData[0] as string[];
        const requiredCols = REQUIRED_COLUMNS[system];

        // Validate required columns
        const missingCols = requiredCols.filter(col => !headers.includes(col));
        if (missingCols.length > 0) {
            errors.push(`Missing required columns: ${missingCols.join(', ')}`);
            return { rows, errors, warnings };
        }

        // Parse data rows
        for (let i = 1; i < jsonData.length; i++) {
            const rowData = jsonData[i];
            const rowObj: ParsedRow = {};

            headers.forEach((header, idx) => {
                rowObj[header] = rowData[idx] ?? null;
            });

            // Basic validation: Job ID must exist
            if (!rowObj['Job ID']) {
                warnings.push(`Row ${i + 1}: Missing Job ID, skipping.`);
                continue;
            }

            rows.push(rowObj);
        }

        if (rows.length === 0) {
            errors.push('No valid rows found in file.');
        }

    } catch (err) {
        errors.push(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { rows, errors, warnings };
}

export function normalizeRow(row: ParsedRow, system: 'EZ' | 'IA', importType: ClearCheckImportType): any {
    // Map columns to canonical fields
    const normalized: any = {
        system,
        job_id: row['Job ID']?.toString() || '',
        job_name: row['Job Name']?.toString() || null,
        service: row['Service']?.toString() || null,
        ect: row['ECT']?.toString() || null, // Date string
        street: row['Street Addr']?.toString() || null,
        city: row['City']?.toString() || null,
        state: row['State']?.toString() || null,
        county: row['County']?.toString() || null,
        zip: row['Zip']?.toString() || null,
        rep_display_name: row['Rep']?.toString() || null,
        status: row['Sts']?.toString() || row['Status']?.toString() || null,
        due_client: row['Due']?.toString() || null,
        due_rep: row['Rep Due']?.toString() || null,
        start_date: row['Start']?.toString() || null,
        created_date: row['Created']?.toString() || null,
        completed_date: row['Compl']?.toString() || null,
        submitted_date: row['Submt']?.toString() || null,
        form: row['Form']?.toString() || null,
    };

    // Client mapping logic
    if (system === 'EZ') {
        normalized.client_primary = row['Client']?.toString() || null;
        normalized.subclient = null;
    } else if (system === 'IA') {
        // IA: "Source" -> client_primary, "Client" -> subclient
        normalized.client_primary = row['Source']?.toString() || null;
        normalized.subclient = row['Client']?.toString() || null;
    }

    // Status Refresh Rule for IA
    if (importType === 'IA_SUBMITTED_REFRESH' || importType === 'IA_CANCELED_REFRESH') {
        const rawStatus = row['Sts']?.toString() || row['Status']?.toString() || '';
        if (importType === 'IA_SUBMITTED_REFRESH') {
            normalized.status = 'Submitted';
        } else if (importType === 'IA_CANCELED_REFRESH') {
            normalized.status = rawStatus.toLowerCase().includes('cancel') ? 'Canceled' : rawStatus;
        }
    }

    return normalized;
}
