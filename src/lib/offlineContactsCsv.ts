/**
 * CSV Import/Export utilities for offline contacts
 */

export type ContactType = "vendor_rep" | "rep_vendor";

export interface ParsedVendorRepContact {
  rep_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  systems: string[] | null;
  status: string;
  notes: string | null;
}

export interface ParsedRepVendorContact {
  vendor_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  systems: string[] | null;
  status: string;
  notes: string | null;
}

export interface ParsedRow<T> {
  data: T;
  rowIndex: number;
  isValid: boolean;
  isDuplicate: boolean;
  isDuplicateInFile: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParseResult<T> {
  rows: ParsedRow<T>[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  duplicateInFileRows: number;
}

export interface ExistingContact {
  email: string | null;
  phone: string | null;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Status validation
const VALID_STATUSES = ["active", "inactive", "blocked"];

/**
 * Normalize phone number to digits only for comparison
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Normalize email for comparison
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Parse systems string (semicolon-separated) to array
 */
export function parseSystems(systemsStr: string | null | undefined): string[] | null {
  if (!systemsStr || !systemsStr.trim()) return null;
  return systemsStr
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Format systems array to semicolon-separated string
 */
export function formatSystems(systems: string[] | null | undefined): string {
  if (!systems || systems.length === 0) return "";
  return systems.join(";");
}

/**
 * Parse status value (case-insensitive, default to 'active')
 */
export function parseStatus(statusStr: string | null | undefined): { status: string; warning: string | null } {
  if (!statusStr || !statusStr.trim()) {
    return { status: "active", warning: null };
  }
  const normalized = statusStr.trim().toLowerCase();
  if (VALID_STATUSES.includes(normalized)) {
    return { status: normalized, warning: null };
  }
  return { status: "active", warning: `Invalid status "${statusStr}" defaulted to "active"` };
}

/**
 * Parse CSV content string into rows
 */
export function parseCSVContent(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const rows: string[][] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Handle quoted fields with commas
    const row: string[] = [];
    let field = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          field += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(field.trim());
        field = "";
      } else {
        field += char;
      }
    }
    row.push(field.trim());
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse vendor offline rep contacts CSV
 */
export function parseVendorRepCSV(
  content: string,
  existingContacts: ExistingContact[]
): ParseResult<ParsedVendorRepContact> {
  const rows = parseCSVContent(content);
  
  if (rows.length === 0) {
    return { rows: [], totalRows: 0, validRows: 0, errorRows: 0, duplicateRows: 0, duplicateInFileRows: 0 };
  }
  
  // Check header
  const header = rows[0].map(h => h.toLowerCase().trim());
  const expectedHeaders = ["rep_name", "company", "email", "phone", "systems", "status", "notes"];
  
  // Find column indices
  const colIndex: Record<string, number> = {};
  for (const col of expectedHeaders) {
    const idx = header.indexOf(col);
    colIndex[col] = idx;
  }
  
  // Build existing contact sets for duplicate detection
  const existingEmails = new Set(
    existingContacts
      .filter(c => c.email)
      .map(c => normalizeEmail(c.email))
  );
  const existingPhones = new Set(
    existingContacts
      .filter(c => c.phone)
      .map(c => normalizePhone(c.phone))
  );
  
  // Track duplicates within file
  const fileEmails = new Set<string>();
  const filePhones = new Set<string>();
  
  const parsedRows: ParsedRow<ParsedVendorRepContact>[] = [];
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const getValue = (col: string): string => {
      const idx = colIndex[col];
      if (idx === -1 || idx >= row.length) return "";
      return row[idx]?.trim() || "";
    };
    
    const repName = getValue("rep_name");
    const company = getValue("company") || null;
    const email = getValue("email") || null;
    const phone = getValue("phone") || null;
    const systemsStr = getValue("systems");
    const statusStr = getValue("status");
    const notes = getValue("notes") || null;
    
    // Validation
    if (!repName) {
      errors.push("Rep Name is required");
    }
    
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    
    if (email && !EMAIL_REGEX.test(email)) {
      errors.push("Invalid email format");
    }
    
    const { status, warning: statusWarning } = parseStatus(statusStr);
    if (statusWarning) {
      warnings.push(statusWarning);
    }
    
    const systems = parseSystems(systemsStr);
    
    // Check for duplicates against existing contacts
    let isDuplicate = false;
    if (normalizedEmail && existingEmails.has(normalizedEmail)) {
      isDuplicate = true;
    } else if (normalizedPhone && existingPhones.has(normalizedPhone)) {
      isDuplicate = true;
    }
    
    // Check for duplicates within file
    let isDuplicateInFile = false;
    if (normalizedEmail && fileEmails.has(normalizedEmail)) {
      isDuplicateInFile = true;
    } else if (normalizedPhone && filePhones.has(normalizedPhone)) {
      isDuplicateInFile = true;
    }
    
    // Add to file tracking sets (only if not already duplicate)
    if (!isDuplicateInFile) {
      if (normalizedEmail) fileEmails.add(normalizedEmail);
      if (normalizedPhone) filePhones.add(normalizedPhone);
    }
    
    parsedRows.push({
      data: {
        rep_name: repName,
        company,
        email: email ? email.trim().toLowerCase() : null,
        phone,
        systems,
        status,
        notes,
      },
      rowIndex: i + 1, // 1-indexed for display
      isValid: errors.length === 0 && !isDuplicate && !isDuplicateInFile,
      isDuplicate,
      isDuplicateInFile,
      errors,
      warnings,
    });
  }
  
  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows: parsedRows.filter(r => r.isValid).length,
    errorRows: parsedRows.filter(r => r.errors.length > 0).length,
    duplicateRows: parsedRows.filter(r => r.isDuplicate).length,
    duplicateInFileRows: parsedRows.filter(r => r.isDuplicateInFile).length,
  };
}

/**
 * Parse field rep offline vendor contacts CSV
 */
export function parseRepVendorCSV(
  content: string,
  existingContacts: ExistingContact[]
): ParseResult<ParsedRepVendorContact> {
  const rows = parseCSVContent(content);
  
  if (rows.length === 0) {
    return { rows: [], totalRows: 0, validRows: 0, errorRows: 0, duplicateRows: 0, duplicateInFileRows: 0 };
  }
  
  // Check header
  const header = rows[0].map(h => h.toLowerCase().trim());
  const expectedHeaders = ["vendor_name", "company", "email", "phone", "systems", "status", "notes"];
  
  // Find column indices
  const colIndex: Record<string, number> = {};
  for (const col of expectedHeaders) {
    const idx = header.indexOf(col);
    colIndex[col] = idx;
  }
  
  // Build existing contact sets for duplicate detection
  const existingEmails = new Set(
    existingContacts
      .filter(c => c.email)
      .map(c => normalizeEmail(c.email))
  );
  const existingPhones = new Set(
    existingContacts
      .filter(c => c.phone)
      .map(c => normalizePhone(c.phone))
  );
  
  // Track duplicates within file
  const fileEmails = new Set<string>();
  const filePhones = new Set<string>();
  
  const parsedRows: ParsedRow<ParsedRepVendorContact>[] = [];
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const getValue = (col: string): string => {
      const idx = colIndex[col];
      if (idx === -1 || idx >= row.length) return "";
      return row[idx]?.trim() || "";
    };
    
    const vendorName = getValue("vendor_name");
    const company = getValue("company") || null;
    const email = getValue("email") || null;
    const phone = getValue("phone") || null;
    const systemsStr = getValue("systems");
    const statusStr = getValue("status");
    const notes = getValue("notes") || null;
    
    // Validation
    if (!vendorName) {
      errors.push("Vendor Name is required");
    }
    
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    
    if (email && !EMAIL_REGEX.test(email)) {
      errors.push("Invalid email format");
    }
    
    const { status, warning: statusWarning } = parseStatus(statusStr);
    if (statusWarning) {
      warnings.push(statusWarning);
    }
    
    const systems = parseSystems(systemsStr);
    
    // Check for duplicates against existing contacts
    let isDuplicate = false;
    if (normalizedEmail && existingEmails.has(normalizedEmail)) {
      isDuplicate = true;
    } else if (normalizedPhone && existingPhones.has(normalizedPhone)) {
      isDuplicate = true;
    }
    
    // Check for duplicates within file
    let isDuplicateInFile = false;
    if (normalizedEmail && fileEmails.has(normalizedEmail)) {
      isDuplicateInFile = true;
    } else if (normalizedPhone && filePhones.has(normalizedPhone)) {
      isDuplicateInFile = true;
    }
    
    // Add to file tracking sets (only if not already duplicate)
    if (!isDuplicateInFile) {
      if (normalizedEmail) fileEmails.add(normalizedEmail);
      if (normalizedPhone) filePhones.add(normalizedPhone);
    }
    
    parsedRows.push({
      data: {
        vendor_name: vendorName,
        company,
        email: email ? email.trim().toLowerCase() : null,
        phone,
        systems,
        status,
        notes,
      },
      rowIndex: i + 1, // 1-indexed for display
      isValid: errors.length === 0 && !isDuplicate && !isDuplicateInFile,
      isDuplicate,
      isDuplicateInFile,
      errors,
      warnings,
    });
  }
  
  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows: parsedRows.filter(r => r.isValid).length,
    errorRows: parsedRows.filter(r => r.errors.length > 0).length,
    duplicateRows: parsedRows.filter(r => r.isDuplicate).length,
    duplicateInFileRows: parsedRows.filter(r => r.isDuplicateInFile).length,
  };
}

/**
 * Generate CSV template for vendor offline rep contacts
 */
export function generateVendorRepTemplate(): string {
  return `rep_name,company,email,phone,systems,status,notes
John Smith,ABC Inspections,john@example.com,(555) 123-4567,EZ;IA,active,Great rep - reliable
Jane Doe,XYZ Services,jane@example.com,(555) 987-6543,WorldApp,blocked,Communication issues - reviewing`;
}

/**
 * Generate CSV template for field rep offline vendor contacts
 */
export function generateRepVendorTemplate(): string {
  return `vendor_name,company,email,phone,systems,status,notes
Bob Wilson,National Inspectors Inc,bob@nationalinsp.com,(555) 111-2222,EZ;IA;WorldApp,active,Good vendor - consistent work
Sarah Miller,Regional Services,sarah@regional.com,(555) 333-4444,EZ,blocked,Payment delays - need to discuss`;
}

/**
 * Generate error report CSV
 */
export function generateErrorReportCSV<T extends ParsedVendorRepContact | ParsedRepVendorContact>(
  rows: ParsedRow<T>[],
  type: ContactType
): string {
  const failedRows = rows.filter(r => !r.isValid);
  
  if (type === "vendor_rep") {
    let csv = "row_number,rep_name,company,email,phone,systems,status,notes,error_reason\n";
    for (const row of failedRows) {
      const data = row.data as ParsedVendorRepContact;
      const reason = row.isDuplicate 
        ? "Duplicate (exists in database)" 
        : row.isDuplicateInFile 
          ? "Duplicate (exists earlier in file)" 
          : row.errors.join("; ");
      csv += `${row.rowIndex},"${data.rep_name}","${data.company || ""}","${data.email || ""}","${data.phone || ""}","${formatSystems(data.systems)}","${data.status}","${data.notes || ""}","${reason}"\n`;
    }
    return csv;
  } else {
    let csv = "row_number,vendor_name,company,email,phone,systems,status,notes,error_reason\n";
    for (const row of failedRows) {
      const data = row.data as ParsedRepVendorContact;
      const reason = row.isDuplicate 
        ? "Duplicate (exists in database)" 
        : row.isDuplicateInFile 
          ? "Duplicate (exists earlier in file)" 
          : row.errors.join("; ");
      csv += `${row.rowIndex},"${data.vendor_name}","${data.company || ""}","${data.email || ""}","${data.phone || ""}","${formatSystems(data.systems)}","${data.status}","${data.notes || ""}","${reason}"\n`;
    }
    return csv;
  }
}

/**
 * Download CSV content as file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
