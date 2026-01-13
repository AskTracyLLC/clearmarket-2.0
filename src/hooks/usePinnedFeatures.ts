import { useState, useEffect, useCallback } from "react";
import { useActiveRole } from "@/hooks/useActiveRole";

const MAX_PINS = 6;

const getStorageKey = (role: "vendor" | "rep" | null) => {
  if (role === "vendor") return "cm_pins_vendor";
  if (role === "rep") return "cm_pins_fieldrep";
  return null;
};

interface UsePinnedFeaturesResult {
  pinnedIds: string[];
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => { success: boolean; message?: string };
  canPin: boolean;
}

/**
 * Hook to manage pinned feature items with localStorage persistence per role.
 * Max 6 pinned items allowed.
 */
export function usePinnedFeatures(): UsePinnedFeaturesResult {
  const { effectiveRole } = useActiveRole();
  
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const key = getStorageKey(effectiveRole);
    if (!key) return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Reload pins when role changes
  useEffect(() => {
    const key = getStorageKey(effectiveRole);
    if (!key) {
      setPinnedIds([]);
      return;
    }
    try {
      const stored = localStorage.getItem(key);
      setPinnedIds(stored ? JSON.parse(stored) : []);
    } catch {
      setPinnedIds([]);
    }
  }, [effectiveRole]);

  // Persist pins to localStorage
  useEffect(() => {
    const key = getStorageKey(effectiveRole);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(pinnedIds));
  }, [pinnedIds, effectiveRole]);

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  const togglePin = useCallback((id: string): { success: boolean; message?: string } => {
    if (pinnedIds.includes(id)) {
      // Unpin
      setPinnedIds((prev) => prev.filter((p) => p !== id));
      return { success: true };
    } else {
      // Pin - check limit
      if (pinnedIds.length >= MAX_PINS) {
        return { success: false, message: `Pin limit reached (${MAX_PINS}). Unpin something to add another.` };
      }
      setPinnedIds((prev) => [...prev, id]);
      return { success: true };
    }
  }, [pinnedIds]);

  const canPin = pinnedIds.length < MAX_PINS;

  return {
    pinnedIds,
    isPinned,
    togglePin,
    canPin,
  };
}
