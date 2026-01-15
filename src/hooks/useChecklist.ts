import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useMimic } from "@/hooks/useMimic";
import {
  completeChecklistItem,
  completeChecklistByKey,
  assignDefaultChecklists,
  syncAutoTrackedItems,
  ChecklistProgress,
  loadUserChecklistsForVendorOnboarding,
  ensureVendorOwnerHasOnboarding,
} from "@/lib/checklists";
import {
  resolveVendorChecklistOwnerUserId,
  isVendorStaff,
} from "@/lib/checklistOwnerResolver";

export function useChecklist() {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { effectiveRole } = useActiveRole();
  const [checklists, setChecklists] = useState<ChecklistProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const hasSyncedRef = useRef(false);
  const resolvedOwnerIdRef = useRef<string | null>(null);

  const loadChecklists = useCallback(async () => {
    if (!effectiveUserId) {
      setChecklists([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // For vendor role, resolve the owner user_id for shared onboarding checklist
    let resolvedOwnerId = effectiveUserId;
    if (effectiveRole === "vendor") {
      resolvedOwnerId = await resolveVendorChecklistOwnerUserId(supabase, effectiveUserId);
      resolvedOwnerIdRef.current = resolvedOwnerId;
    }

    // Load checklists - use resolved owner for vendor onboarding
    const data = await loadUserChecklistsForVendorOnboarding(supabase, effectiveUserId, resolvedOwnerId);
    
    // If no checklists assigned yet, try to assign defaults (only for real user, not mimic)
    if (data.length === 0 && effectiveRole && effectiveUserId === user?.id) {
      const role = effectiveRole === "rep" ? "field_rep" : "vendor";
      
      // For vendor role, check if user is staff - if so, ensure owner has the assignment
      if (role === "vendor") {
        const isStaff = await isVendorStaff(supabase, effectiveUserId);
        if (isStaff && resolvedOwnerId !== effectiveUserId) {
          // Ensure owner has the vendor onboarding assignment
          await ensureVendorOwnerHasOnboarding(supabase, resolvedOwnerId);
        } else {
          // Owner - assign defaults normally
          await assignDefaultChecklists(supabase, effectiveUserId, role);
        }
      } else {
        // Field rep - assign defaults normally
        await assignDefaultChecklists(supabase, effectiveUserId, role);
      }
      
      // Run sync for auto-tracked items immediately after assignment
      await syncAutoTrackedItems(supabase, resolvedOwnerId);
      
      // Reload after assignment and sync
      const newData = await loadUserChecklistsForVendorOnboarding(supabase, effectiveUserId, resolvedOwnerId);
      setChecklists(newData);
      hasSyncedRef.current = true;
    } else {
      setChecklists(data);
      
      // Run sync once on first load if we haven't already (only for real user)
      if (!hasSyncedRef.current && data.length > 0 && effectiveUserId === user?.id) {
        hasSyncedRef.current = true;
        const syncedCount = await syncAutoTrackedItems(supabase, resolvedOwnerId);
        if (syncedCount > 0) {
          // Reload to show updated status
          const updatedData = await loadUserChecklistsForVendorOnboarding(supabase, effectiveUserId, resolvedOwnerId);
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
    resolvedOwnerIdRef.current = null;
  }, [effectiveUserId]);

  const markComplete = useCallback(async (userItemId: string) => {
    // Get the actual logged-in user for completed_by attribution
    const completedByUserId = effectiveUserId || user?.id;
    const success = await completeChecklistItem(supabase, userItemId, completedByUserId);
    if (success) {
      await loadChecklists();
    }
    return success;
  }, [loadChecklists, effectiveUserId, user?.id]);

  const trackEvent = useCallback(async (autoTrackKey: string) => {
    if (!effectiveUserId) return;
    
    // For vendor onboarding events, use the resolved owner ID
    const targetUserId = resolvedOwnerIdRef.current || effectiveUserId;
    await completeChecklistByKey(supabase, targetUserId, autoTrackKey, effectiveUserId);
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
