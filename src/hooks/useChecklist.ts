import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import {
  loadUserChecklists,
  completeChecklistItem,
  completeChecklistByKey,
  assignDefaultChecklists,
  syncAutoTrackedItems,
  ChecklistProgress,
} from "@/lib/checklists";

export function useChecklist() {
  const { user } = useAuth();
  const { effectiveRole } = useActiveRole();
  const [checklists, setChecklists] = useState<ChecklistProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const hasSyncedRef = useRef(false);

  const loadChecklists = useCallback(async () => {
    if (!user) {
      setChecklists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const data = await loadUserChecklists(supabase, user.id);
    
    // If no checklists assigned yet, try to assign defaults
    if (data.length === 0 && effectiveRole) {
      const role = effectiveRole === "rep" ? "field_rep" : "vendor";
      await assignDefaultChecklists(supabase, user.id, role);
      
      // Run sync for auto-tracked items immediately after assignment
      await syncAutoTrackedItems(supabase, user.id);
      
      // Reload after assignment and sync
      const newData = await loadUserChecklists(supabase, user.id);
      setChecklists(newData);
      hasSyncedRef.current = true;
    } else {
      setChecklists(data);
      
      // Run sync once on first load if we haven't already
      if (!hasSyncedRef.current && data.length > 0) {
        hasSyncedRef.current = true;
        const syncedCount = await syncAutoTrackedItems(supabase, user.id);
        if (syncedCount > 0) {
          // Reload to show updated status
          const updatedData = await loadUserChecklists(supabase, user.id);
          setChecklists(updatedData);
        }
      }
    }
    
    setLoading(false);
  }, [user, effectiveRole]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  // Reset sync flag when user changes
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [user?.id]);

  const markComplete = useCallback(async (userItemId: string) => {
    const success = await completeChecklistItem(supabase, userItemId);
    if (success) {
      await loadChecklists();
    }
    return success;
  }, [loadChecklists]);

  const trackEvent = useCallback(async (autoTrackKey: string) => {
    if (!user) return;
    await completeChecklistByKey(supabase, user.id, autoTrackKey);
    await loadChecklists();
  }, [user, loadChecklists]);

  // Get the primary checklist for the current role
  const primaryChecklist = checklists.find(c => {
    if (effectiveRole === "rep") {
      return c.template.role === "field_rep" && c.template.owner_type === "system";
    } else if (effectiveRole === "vendor") {
      return c.template.role === "vendor" && c.template.owner_type === "system";
    }
    return false;
  });

  // Get vendor-assigned checklists (for field reps)
  const vendorChecklists = checklists.filter(c => c.template.owner_type === "vendor");

  return {
    checklists,
    primaryChecklist,
    vendorChecklists,
    loading,
    reload: loadChecklists,
    markComplete,
    trackEvent,
  };
}
