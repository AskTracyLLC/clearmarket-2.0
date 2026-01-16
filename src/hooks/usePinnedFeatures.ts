import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MAX_PINS = 6;
const DEBOUNCE_MS = 500;

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
 * Hook to manage pinned feature items with DB persistence (user_ui_preferences) and localStorage fallback.
 * Max 6 pinned items allowed.
 */
export function usePinnedFeatures(): UsePinnedFeaturesResult {
  const { effectiveRole } = useActiveRole();
  const { user } = useAuth();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  
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

  // Load pins from DB on auth
  useEffect(() => {
    if (!user?.id || initialLoadDone.current) return;
    
    const loadFromDB = async () => {
      try {
        const { data, error } = await supabase
          .from("user_ui_preferences")
          .select("pinned_sidebar")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error loading pinned sidebar preferences:", error);
          return;
        }

        if (data?.pinned_sidebar) {
          const dbPins = data.pinned_sidebar as Record<string, string[]>;
          const key = getStorageKey(effectiveRole);
          if (key && dbPins[key]) {
            setPinnedIds(dbPins[key]);
            // Also update localStorage cache
            localStorage.setItem(key, JSON.stringify(dbPins[key]));
          }
        }
        initialLoadDone.current = true;
      } catch (err) {
        console.error("Error loading pins from DB:", err);
      }
    };

    loadFromDB();
  }, [user?.id, effectiveRole]);

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

  // Persist pins to localStorage and DB (debounced)
  useEffect(() => {
    const key = getStorageKey(effectiveRole);
    if (!key) return;
    
    // Always update localStorage immediately
    localStorage.setItem(key, JSON.stringify(pinnedIds));
    
    // Debounce DB update
    if (!user?.id) return;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(async () => {
      try {
        // Get current DB state
        const { data: existing } = await supabase
          .from("user_ui_preferences")
          .select("pinned_sidebar")
          .eq("user_id", user.id)
          .maybeSingle();

        const currentPins = (existing?.pinned_sidebar || {}) as Record<string, string[]>;
        const updatedPins = { ...currentPins, [key]: pinnedIds };

        if (existing) {
          await supabase
            .from("user_ui_preferences")
            .update({ pinned_sidebar: updatedPins })
            .eq("user_id", user.id);
        } else {
          await supabase
            .from("user_ui_preferences")
            .insert({ user_id: user.id, pinned_sidebar: updatedPins });
        }
      } catch (err) {
        console.error("Error persisting pins to DB:", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [pinnedIds, effectiveRole, user?.id]);

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
