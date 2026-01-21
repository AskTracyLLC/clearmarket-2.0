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

// Normalize column names for flexible matching
const normalizeColName = (name: string | null | undefined) => {
    if (!name) return '';
    return String(name).toLowerCase().trim();
};

// Helper to find column value case-insensitively
function getColValue(row: ParsedRow, ...possibleNames: string[]): any {
    for (const key of Object.keys(row)) {
        const normalizedKey = normalizeColName(key);
        for (const name of possibleNames) {
            if (normalizedKey === normalizeColName(name)) {
                return row[key];
            }
        }
    }
    return null;
}

const REQUIRED_COLUMNS = {
    EZ: ['job id', 'street addr', 'city', 'state', 'county', 'created', 'due', 'rep', 'client'],
    IA: ['job id', 'street addr', 'city', 'state', 'county', 'created', 'due', 'rep', 'source'], // IA uses "Source" instead of "Client"
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
        const normalizedHeaders = headers.map(normalizeColName);
        const requiredCols = REQUIRED_COLUMNS[system];

        // Validate required columns (case-insensitive)
        const missingCols = requiredCols.filter(col => !normalizedHeaders.includes(col));
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
            const jobId = getColValue(rowObj, 'Job ID', 'Job Id');
            if (!jobId) {
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
    // Map columns to canonical fields (case-insensitive lookup)
    const normalized: any = {
        system,
        job_id: getColValue(row, 'Job ID', 'Job Id')?.toString() || '',
        job_name: getColValue(row, 'Job Name')?.toString() || null,
        service: getColValue(row, 'Service')?.toString() || null,
        ect: getColValue(row, 'ECT', 'Est. Completion (ECT)')?.toString() || null, // Date string
        street: getColValue(row, 'Street Addr')?.toString() || null,
        city: getColValue(row, 'City')?.toString() || null,
        state: getColValue(row, 'State')?.toString() || null,
        county: getColValue(row, 'County')?.toString() || null,
        zip: getColValue(row, 'Zip')?.toString() || null,
        rep_display_name: getColValue(row, 'Rep')?.toString() || null,
        status: getColValue(row, 'Sts', 'Status')?.toString() || null,
        due_client: getColValue(row, 'Due')?.toString() || null,
        due_rep: getColValue(row, 'Rep Due')?.toString() || null,
        start_date: getColValue(row, 'Start')?.toString() || null,
        created_date: getColValue(row, 'Created')?.toString() || null,
        completed_date: getColValue(row, 'Compl')?.toString() || null,
        submitted_date: getColValue(row, 'Submt')?.toString() || null,
        form: getColValue(row, 'Form')?.toString() || null,
    };

    // Client mapping logic
    if (system === 'EZ') {
        normalized.client_primary = getColValue(row, 'Client')?.toString() || null;
        normalized.subclient = null;
    } else if (system === 'IA') {
        // IA: "Source" -> client_primary, "Client" -> subclient
        normalized.client_primary = getColValue(row, 'Source')?.toString() || null;
        normalized.subclient = getColValue(row, 'Client')?.toString() || null;
    }

    // Status Refresh Rule for IA
    if (importType === 'IA_SUBMITTED_REFRESH' || importType === 'IA_CANCELED_REFRESH') {
        const rawStatus = getColValue(row, 'Sts', 'Status')?.toString() || '';
        if (importType === 'IA_SUBMITTED_REFRESH') {
            normalized.status = 'Submitted';
        } else if (importType === 'IA_CANCELED_REFRESH') {
            normalized.status = rawStatus.toLowerCase().includes('cancel') ? 'Canceled' : rawStatus;
        }
    }

    return normalized;
}
