/**
 * Hook for managing proposal debug state
 */

import { useState, useCallback, useEffect } from "react";
import {
  DebugState,
  CapturedError,
  captureSupabaseError,
  saveDebugState,
  loadDebugState,
  clearDebugState,
  isDebugModeEnabled,
  getErrorHint,
  isRlsError,
} from "@/lib/proposalDebug";
import { toast } from "sonner";

export function useProposalDebug(proposalId?: string | null) {
  const [debugState, setDebugState] = useState<DebugState>(() => loadDebugState());
  const debugEnabled = isDebugModeEnabled();

  // Reload debug state on mount
  useEffect(() => {
    if (debugEnabled) {
      setDebugState(loadDebugState());
    }
  }, [debugEnabled]);

  /**
   * Record a successful operation (for payload tracking)
   */
  const recordOperation = useCallback(
    (operationName: string, payload: unknown) => {
      if (!debugEnabled) return;

      const newState: Partial<DebugState> = {
        lastOperationName: operationName,
        lastPayload: payload,
        lastError: null,
        proposalId: proposalId || null,
      };

      saveDebugState(newState);
      setDebugState((prev) => ({ ...prev, ...newState, timestamp: new Date().toISOString() }));
    },
    [debugEnabled, proposalId]
  );

  /**
   * Record an error from a failed operation
   */
  const recordError = useCallback(
    (operationName: string, payload: unknown, error: unknown) => {
      const captured = captureSupabaseError(error);

      // Always log to console
      console.error(`[ProposalDebug] ${operationName} failed:`, {
        payload,
        error: captured,
        rawError: error,
      });

      // Show toast with error hint
      const hint = getErrorHint(captured);
      const isRls = isRlsError(captured);

      if (debugEnabled) {
        toast.error(
          isRls
            ? "Action failed (RLS issue). Open Debug panel for details."
            : "Action failed. Open Debug panel for details."
        );
      } else {
        toast.error(hint || captured.message || "Action failed");
      }

      if (!debugEnabled) return;

      const newState: Partial<DebugState> = {
        lastOperationName: operationName,
        lastPayload: payload,
        lastError: captured,
        proposalId: proposalId || null,
      };

      saveDebugState(newState);
      setDebugState((prev) => ({ ...prev, ...newState, timestamp: new Date().toISOString() }));
    },
    [debugEnabled, proposalId]
  );

  /**
   * Clear the debug state
   */
  const clear = useCallback(() => {
    clearDebugState();
    setDebugState({
      authUserId: null,
      effectiveRole: null,
      effectiveUserId: null,
      proposalId: null,
      lastOperationName: null,
      lastPayload: null,
      lastError: null,
      timestamp: null,
    });
  }, []);

  /**
   * Wrapper for async operations that captures errors
   */
  const withDebug = useCallback(
    async <T,>(
      operationName: string,
      payload: unknown,
      fn: () => Promise<T>
    ): Promise<T> => {
      recordOperation(operationName, payload);
      try {
        return await fn();
      } catch (error) {
        recordError(operationName, payload, error);
        throw error;
      }
    },
    [recordOperation, recordError]
  );

  return {
    debugState,
    debugEnabled,
    recordOperation,
    recordError,
    clear,
    withDebug,
  };
}
