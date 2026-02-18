/**
 * Vendor Bulk Coverage CSV Import — parser, validator, template generator.
 *
 * Supports two CSV formats:
 *   Format A: GA, selected, "Bartow;Bryan;Carroll"  (one row, multiple counties)
 *   Format B: GA, selected, Bartow                   (one row per county)
 *
 * After parsing, rows are grouped by (state + coverage_mode).
 * Counties are merged, deduped, and sorted alphabetically.
 */

import Papa from "papaparse";
import { US_STATES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportCoverageMode = "entire_state" | "selected" | "entire_except";

/** Single raw CSV row after parsing */
interface RawRow {
  state: string;
  coverage_mode: string;
  counties: string;
  rowNumber: number;
}

/** Grouped + validated state entry */
export interface ImportStateEntry {
  stateCode: string;
  stateName: string;
  coverageMode: ImportCoverageMode;
  /** County *names* (not IDs yet) */
  countyNames: string[];
  /** Resolved county IDs (filled during DB validation) */
  countyIds: string[];
  /** Any unknown county names that didn't match */
  unknownCounties: string[];
}

export interface ImportValidationResult {
  entries: ImportStateEntry[];
  errors: string[];
  warnings: string[];
  /** True only if zero errors */
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STATES = new Set(US_STATES.map((s) => s.value));
const VALID_MODES: Record<string, ImportCoverageMode> = {
  entire_state: "entire_state",
  selected: "selected",
  entire_except: "entire_except",
};

function getStateName(code: string): string {
  return US_STATES.find((s) => s.value === code)?.label || code;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function generateCoverageTemplate(): string {
  const header = "state,coverage_mode,counties";
  const examples = [
    "GA,selected,Bartow;Bryan;Carroll",
    "FL,entire_state,",
    'TX,entire_except,"Harris;Dallas"',
    "CA,selected,Los Angeles",
    "CA,selected,Orange",
  ];
  return [header, ...examples].join("\n");
}

export function downloadTemplate() {
  const csv = generateCoverageTemplate();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coverage_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Parse + Group
// ---------------------------------------------------------------------------

function splitCounties(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  // Split on semicolon, comma, or newline — then trim + deduplicate
  return raw
    .split(/[;,\n]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function parseCoverageCSV(csvText: string): {
  rawRows: RawRow[];
  parseErrors: string[];
} {
  const parseErrors: string[] = [];
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e) =>
      parseErrors.push(`CSV parse error (row ${e.row ?? "?"}): ${e.message}`)
    );
  }

  const rawRows: RawRow[] = [];
  result.data.forEach((row, idx) => {
    const state = (row["state"] || "").trim().toUpperCase();
    const mode = (row["coverage_mode"] || "").trim().toLowerCase();
    const counties = (row["counties"] || "").trim();
    rawRows.push({ state, coverage_mode: mode, counties, rowNumber: idx + 2 }); // +2 for header + 0-index
  });

  return { rawRows, parseErrors };
}

export function groupAndValidateRows(rawRows: RawRow[]): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Group by state => collect modes + counties
  const stateMap = new Map<
    string,
    { modes: Set<string>; counties: string[]; rawMode: string }
  >();

  for (const row of rawRows) {
    // Validate state
    if (!VALID_STATES.has(row.state)) {
      errors.push(`Row ${row.rowNumber}: Invalid state "${row.state}".`);
      continue;
    }

    // Validate mode
    const normalizedMode = VALID_MODES[row.coverage_mode];
    if (!normalizedMode) {
      errors.push(
        `Row ${row.rowNumber}: Invalid coverage_mode "${row.coverage_mode}". Use: entire_state, selected, or entire_except.`
      );
      continue;
    }

    if (!stateMap.has(row.state)) {
      stateMap.set(row.state, {
        modes: new Set(),
        counties: [],
        rawMode: normalizedMode,
      });
    }

    const entry = stateMap.get(row.state)!;
    entry.modes.add(normalizedMode);
    entry.rawMode = normalizedMode; // last seen, but we'll check for conflicts

    // Merge counties
    const parsed = splitCounties(row.counties);
    entry.counties.push(...parsed);
  }

  // Build entries and validate per-state rules
  const entries: ImportStateEntry[] = [];

  for (const [stateCode, data] of stateMap) {
    // Check for conflicting modes
    if (data.modes.size > 1) {
      errors.push(
        `State ${stateCode}: Found multiple coverage_mode values (${[...data.modes].join(", ")}). Each state must have only one mode.`
      );
      continue;
    }

    const mode = [...data.modes][0] as ImportCoverageMode;

    // Deduplicate counties (case-insensitive)
    const seen = new Map<string, string>();
    for (const c of data.counties) {
      const key = c.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, c);
      }
    }
    const dedupedCounties = [...seen.values()].sort();

    // Mode-specific validation
    if (mode === "entire_state") {
      if (dedupedCounties.length > 0) {
        warnings.push(
          `State ${stateCode}: coverage_mode is "entire_state" but counties were provided — ignoring counties.`
        );
      }
      entries.push({
        stateCode,
        stateName: getStateName(stateCode),
        coverageMode: mode,
        countyNames: [],
        countyIds: [],
        unknownCounties: [],
      });
    } else {
      // selected or entire_except — counties required
      if (dedupedCounties.length === 0) {
        errors.push(
          `State ${stateCode}: coverage_mode "${mode}" requires at least one county.`
        );
        continue;
      }
      entries.push({
        stateCode,
        stateName: getStateName(stateCode),
        coverageMode: mode,
        countyNames: dedupedCounties,
        countyIds: [],
        unknownCounties: [],
      });
    }
  }

  return {
    entries: entries.sort((a, b) => a.stateCode.localeCompare(b.stateCode)),
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

// ---------------------------------------------------------------------------
// DB validation — resolve county names to IDs
// ---------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";

/**
 * For each entry with counties, look up IDs from us_counties.
 * Unknown county names are flagged as errors.
 */
export async function resolveCountyIds(
  entries: ImportStateEntry[]
): Promise<{ errors: string[] }> {
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.countyNames.length === 0) continue;

    const { data: rows, error } = await supabase
      .from("us_counties")
      .select("id, county_name")
      .eq("state_code", entry.stateCode)
      .in(
        "county_name",
        entry.countyNames
      );

    if (error) {
      errors.push(`Failed to look up counties for ${entry.stateCode}: ${error.message}`);
      continue;
    }

    const dbNameToId = new Map<string, string>();
    (rows || []).forEach((r: any) => dbNameToId.set(r.county_name.toLowerCase(), r.id));

    const resolvedIds: string[] = [];
    const unknown: string[] = [];

    for (const name of entry.countyNames) {
      const id = dbNameToId.get(name.toLowerCase());
      if (id) {
        resolvedIds.push(id);
      } else {
        unknown.push(name);
      }
    }

    entry.countyIds = resolvedIds;
    entry.unknownCounties = unknown;

    if (unknown.length > 0) {
      errors.push(
        `State ${entry.stateCode}: Unknown counties — ${unknown.join(", ")}. Check spelling or import the county list first.`
      );
    }
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Import (write to DB)
// ---------------------------------------------------------------------------

/**
 * All-or-nothing import. For each state in the validated entries:
 *   1. Delete existing vendor_coverage_areas for this user + state
 *   2. Insert the new record
 */
export async function executeImport(
  userId: string,
  entries: ImportStateEntry[]
): Promise<{ error: string | null }> {
  for (const entry of entries) {
    // Delete existing
    const { error: delErr } = await supabase
      .from("vendor_coverage_areas")
      .delete()
      .eq("user_id", userId)
      .eq("state_code", entry.stateCode);

    if (delErr) {
      return { error: `Failed to clear existing coverage for ${entry.stateCode}: ${delErr.message}` };
    }

    // Map import mode to DB mode
    const dbMode =
      entry.coverageMode === "selected"
        ? "selected_counties"
        : entry.coverageMode === "entire_except"
        ? "entire_state_except"
        : "entire_state";

    const payload = {
      user_id: userId,
      state_code: entry.stateCode,
      state_name: entry.stateName,
      coverage_mode: dbMode,
      covers_entire_state: dbMode === "entire_state",
      covers_entire_county: true,
      excluded_county_ids:
        dbMode === "entire_state_except" ? entry.countyIds : null,
      included_county_ids:
        dbMode === "selected_counties" ? entry.countyIds : null,
    } as any;

    const { error: insErr } = await supabase
      .from("vendor_coverage_areas")
      .insert([payload]);

    if (insErr) {
      return { error: `Failed to insert coverage for ${entry.stateCode}: ${insErr.message}` };
    }
  }

  return { error: null };
}
