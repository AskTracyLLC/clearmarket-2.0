/**
 * useRepBoostStatus Hook
 * 
 * Fetches current boost status for a rep and provides purchase functionality.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { useActiveRole } from "@/hooks/useActiveRole";

export interface RepBoostStatus {
  isBoosted: boolean;
  activeEndsAt: string | null;
  activeStartsAt: string | null;
}

export interface BoostPurchaseResult {
  ok: boolean;
  error?: string;
  boost_id?: string;
  new_balance?: number;
  ends_at?: string;
  extended?: boolean;
}

export interface UseRepBoostStatusResult {
  status: RepBoostStatus;
  loading: boolean;
  purchasing: boolean;
  purchaseBoost: () => Promise<BoostPurchaseResult>;
  refresh: () => Promise<void>;
}

const DEFAULT_STATUS: RepBoostStatus = {
  isBoosted: false,
  activeEndsAt: null,
  activeStartsAt: null,
};

export function useRepBoostStatus(): UseRepBoostStatusResult {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { effectiveRole } = useActiveRole();

  const [status, setStatus] = useState<RepBoostStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!effectiveUserId || effectiveRole !== "rep") {
      setStatus(DEFAULT_STATUS);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("rep_active_boost_status")
        .select("*")
        .eq("rep_user_id", effectiveUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching boost status:", error);
        setStatus(DEFAULT_STATUS);
      } else if (data) {
        setStatus({
          isBoosted: data.is_boosted ?? false,
          activeEndsAt: data.active_ends_at ?? null,
          activeStartsAt: data.active_starts_at ?? null,
        });
      } else {
        setStatus(DEFAULT_STATUS);
      }
    } catch (err) {
      console.error("Error in useRepBoostStatus:", err);
      setStatus(DEFAULT_STATUS);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, effectiveRole]);

  const purchaseBoost = useCallback(async (): Promise<BoostPurchaseResult> => {
    if (!user?.id || effectiveUserId !== user.id) {
      return { ok: false, error: "Cannot purchase while viewing as another user" };
    }

    setPurchasing(true);
    try {
      const { data, error } = await supabase.rpc("purchase_rep_boost", {
        p_hours: 48,
        p_cost: 2,
      });

      if (error) {
        console.error("Error purchasing boost:", error);
        return { ok: false, error: error.message };
      }

      // Handle null or non-object responses
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: "Invalid response from server" };
      }

      const result = data as unknown as BoostPurchaseResult;

      if (result.ok) {
        await fetchStatus();
      }

      return result;
    } catch (err) {
      console.error("Error in purchaseBoost:", err);
      return { ok: false, error: "An unexpected error occurred" };
    } finally {
      setPurchasing(false);
    }
  }, [user?.id, effectiveUserId, fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    purchasing,
    purchaseBoost,
    refresh: fetchStatus,
  };
}
