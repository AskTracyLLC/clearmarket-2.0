import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useMimic } from "@/hooks/useMimic";
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
  const { effectiveUserId } = useMimic();
  const { effectiveRole } = useActiveRole();
  const [checklists, setChecklists] = useState<ChecklistProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const hasSyncedRef = useRef(false);

  const loadChecklists = useCallback(async () => {
    if (!effectiveUserId) {
      setChecklists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const data = await loadUserChecklists(supabase, effectiveUserId);
    
    // If no checklists assigned yet, try to assign defaults (only for real user, not mimic)
    if (data.length === 0 && effectiveRole && effectiveUserId === user?.id) {
      const role = effectiveRole === "rep" ? "field_rep" : "vendor";
      await assignDefaultChecklists(supabase, effectiveUserId, role);
      
      // Run sync for auto-tracked items immediately after assignment
      await syncAutoTrackedItems(supabase, effectiveUserId);
      
      // Reload after assignment and sync
      const newData = await loadUserChecklists(supabase, effectiveUserId);
      setChecklists(newData);
      hasSyncedRef.current = true;
    } else {
      setChecklists(data);
      
      // Run sync once on first load if we haven't already (only for real user)
      if (!hasSyncedRef.current && data.length > 0 && effectiveUserId === user?.id) {
        hasSyncedRef.current = true;
        const syncedCount = await syncAutoTrackedItems(supabase, effectiveUserId);
        if (syncedCount > 0) {
          // Reload to show updated status
          const updatedData = await loadUserChecklists(supabase, effectiveUserId);
          setChecklists(updatedData);
        }
      }
    }
    
    setLoading(false);
  }, [effectiveUserId, effectiveRole, user?.id]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  // Reset sync flag when effective user changes
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [effectiveUserId]);

  const markComplete = useCallback(async (userItemId: string) => {
    const success = await completeChecklistItem(supabase, userItemId);
    if (success) {
      await loadChecklists();
    }
    return success;
  }, [loadChecklists]);

  const trackEvent = useCallback(async (autoTrackKey: string) => {
    if (!effectiveUserId) return;
    await completeChecklistByKey(supabase, effectiveUserId, autoTrackKey);
    await loadChecklists();
  }, [effectiveUserId, loadChecklists]);

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
