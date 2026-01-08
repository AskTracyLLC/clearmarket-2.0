/**
 * Proposal Debug Utilities
 * Captures and exposes Supabase errors for debugging vendor proposal actions
 */

import { supabase } from "@/integrations/supabase/client";

export interface CapturedError {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
  status: number | null;
}

export interface DebugState {
  authUserId: string | null;
  effectiveRole: string | null;
  effectiveUserId: string | null;
  proposalId: string | null;
  lastOperationName: string | null;
  lastPayload: unknown;
  lastError: CapturedError | null;
  timestamp: string | null;
}

const STORAGE_KEY = "cm_proposal_debug";

/**
 * Check if debug mode is enabled via URL param or localStorage
 */
export function isDebugModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check URL param
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("debug") === "1") return true;
  
  // Check localStorage
  try {
    return localStorage.getItem("cm_debug") === "1";
  } catch {
    return false;
  }
}

/**
 * Extract structured error info from a Supabase error
 */
export function captureSupabaseError(err: unknown): CapturedError {
  if (!err) {
    return {
      message: "Unknown error",
      code: null,
      details: null,
      hint: null,
      status: null,
    };
  }

  // Supabase PostgrestError shape
  const pgError = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
  };

  return {
    message: pgError.message || String(err),
    code: pgError.code || null,
    details: pgError.details || null,
    hint: pgError.hint || null,
    status: pgError.status || null,
  };
}

/**
 * Check if error looks like an RLS issue
 */
export function isRlsError(error: CapturedError): boolean {
  const msg = error.message?.toLowerCase() || "";
  const hint = error.hint?.toLowerCase() || "";
  
  return (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("permission denied") ||
    error.status === 401 ||
    error.status === 403 ||
    error.code === "42501" || // insufficient_privilege
    hint.includes("rls")
  );
}

/**
 * Get human-readable hint for common errors
 */
export function getErrorHint(error: CapturedError): string | null {
  if (isRlsError(error)) {
    return "This looks like an auth/RLS issue. Confirm vendor_user_id uses auth user id.";
  }
  
  if (error.code === "23505") {
    return "Duplicate entry. This record may already exist.";
  }
  
  if (error.code === "23503") {
    return "Foreign key violation. A referenced record may not exist.";
  }
  
  return null;
}

/**
 * Save debug state to localStorage for persistence across refresh
 */
export function saveDebugState(state: Partial<DebugState>): void {
  try {
    const existing = loadDebugState();
    const updated = { ...existing, ...state, timestamp: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load debug state from localStorage
 */
export function loadDebugState(): DebugState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  
  return {
    authUserId: null,
    effectiveRole: null,
    effectiveUserId: null,
    proposalId: null,
    lastOperationName: null,
    lastPayload: null,
    lastError: null,
    timestamp: null,
  };
}

/**
 * Clear debug state
 */
export function clearDebugState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Get current auth user ID
 */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Copy debug state to clipboard as JSON
 */
export function copyDebugToClipboard(state: DebugState): void {
  const text = JSON.stringify(state, null, 2);
  navigator.clipboard.writeText(text).catch(console.error);
}
