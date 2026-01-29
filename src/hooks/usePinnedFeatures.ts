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
 * Max 6 pinned items allowed. DB is source of truth; localStorage is a cache for instant display.
 */
export function usePinnedFeatures(): UsePinnedFeaturesResult {
  const { effectiveRole } = useActiveRole();
  const { user } = useAuth();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Track which user+role combo we've loaded from DB to avoid duplicate loads
  const loadedKeyRef = useRef<string | null>(null);

  // Load pins from DB on auth or role change - DB is source of truth
  useEffect(() => {
    const key = getStorageKey(effectiveRole);
    const loadKey = user?.id && key ? `${user.id}_${key}` : null;
    
    // If no user or no role, reset state
    if (!loadKey || !key) {
      setPinnedIds([]);
      setIsHydrated(false);
      loadedKeyRef.current = null;
      return;
    }
    
    // If we've already loaded this exact user+role combo, skip
    if (loadedKeyRef.current === loadKey) {
      return;
    }
    
    // First, try to load from localStorage for immediate display (cache)
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPinnedIds(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    
    // Then load from DB (source of truth) - this will override localStorage data
    const loadFromDB = async () => {
      try {
        const { data, error } = await supabase
          .from("user_ui_preferences")
          .select("pinned_sidebar")
          .eq("user_id", user!.id)
          .maybeSingle();

        if (error) {
          console.error("Error loading pinned sidebar preferences:", error);
        } else if (data?.pinned_sidebar) {
          const dbPins = data.pinned_sidebar as Record<string, string[]>;
          const pinsForRole = dbPins[key] || [];
          setPinnedIds(pinsForRole);
          // Update localStorage cache to match DB
          localStorage.setItem(key, JSON.stringify(pinsForRole));
        } else {
          // No DB record exists yet - keep localStorage data (if any) or empty
          // This handles first-time users
        }
        
        loadedKeyRef.current = loadKey;
        setIsHydrated(true);
      } catch (err) {
        console.error("Error loading pins from DB:", err);
        loadedKeyRef.current = loadKey;
        setIsHydrated(true);
      }
    };

    loadFromDB();
  }, [user?.id, effectiveRole]);

  // Persist pins to localStorage and DB (debounced) - only after hydration
  useEffect(() => {
    // Don't persist until we've hydrated from DB to avoid overwriting with stale data
    if (!isHydrated) return;
    
    const key = getStorageKey(effectiveRole);
    if (!key) return;
    
    // Always update localStorage immediately for instant feedback
    localStorage.setItem(key, JSON.stringify(pinnedIds));
    
    // Debounce DB update
    if (!user?.id) return;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(async () => {
      try {
        // Get current DB state to preserve other role's pins
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
  }, [pinnedIds, effectiveRole, user?.id, isHydrated]);

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
